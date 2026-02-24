# Implementation Spec: Skill Eval Harness - Phase 1

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Phase 1 builds the complete eval infrastructure: types, Anthropic API wrapper, response cache, deterministic scorer, orchestration runner, reporter, CLI entrypoint, and scorer unit tests. After this phase, running `bun run eval -- --dry-run` works, and a single test case can be scored end-to-end.

The architecture mirrors the existing generation pipeline: a CLI entrypoint (`eval.ts`) orchestrates modules in `eval/`, following the same patterns as `generate.ts` orchestrating `lib/`. The API wrapper reuses the `refiner.ts` fetch pattern. Scoring follows the `quality-gate.ts` rubric pattern. YAML parsing uses the existing `yaml` dependency.

All eval modules live in `scripts/eval/` to keep them separate from the generation pipeline while sharing the same project infrastructure.

## Feedback Strategy

**Inner-loop command**: `bun test --filter eval`

**Playground**: Test suite — the scorer is pure logic (no API calls), so unit tests are the tightest loop. The runner can be validated with `--dry-run` mode.

**Why this approach**: Most Phase 1 work is the scorer (pure functions with deterministic inputs/outputs). Tests run in milliseconds and catch scoring bugs immediately.

## File Changes

### New Files

| File Path | Purpose |
|-----------|---------|
| `scripts/eval/types.ts` | EvalCase, ScoreCard, EvalResult, EvalReport interfaces |
| `scripts/eval/api.ts` | Anthropic API wrapper (fetch pattern from refiner.ts) |
| `scripts/eval/cache.ts` | Content-addressed response cache (SHA-256 keyed) |
| `scripts/eval/scorer.ts` | Deterministic scoring: ratioFound, scoreFlowOrder, weightedScore, categorizeErrors |
| `scripts/eval/runner.ts` | Orchestrator: load YAML cases, load skills, call API, score, aggregate |
| `scripts/eval/reporter.ts` | JSON file writer + console table formatter |
| `scripts/eval.ts` | CLI entrypoint with arg parsing |
| `scripts/tests/eval-scorer.spec.ts` | Unit tests for scoring functions |

### Modified Files

| File Path | Changes |
|-----------|---------|
| `package.json` | Add `"eval": "bun run scripts/eval.ts"` to scripts |

## Implementation Details

### Types (`scripts/eval/types.ts`)

**Pattern to follow**: `scripts/lib/types.ts`

**Overview**: All interfaces for the eval system. Parallels how `types.ts` defines `GeneratedSkill`, `SkillSpec`, `QualityResult` for the generation pipeline.

```typescript
export interface EvalCase {
  id: string;
  product: string;
  skill: string;           // skill name to load (e.g., "workos-sso")
  skillType: "generated" | "hand-crafted";
  language?: string;        // "node" | "python" | "ruby"
  framework?: string;       // "nextjs" | "express"
  prompt: string;
  expected: ExpectedSignals;
}

export interface ExpectedSignals {
  methods: string[];
  envVars: string[];
  imports: string[];
  params: string[];
  flowSteps: string[];
  antiPatterns: string[];
  hallucinations?: string[];
}

export interface ScoreCard {
  methodAccuracy: number;       // 0-1
  paramAccuracy: number;        // 0-1
  envVarCoverage: number;       // 0-1
  flowCorrectness: number;      // 0-1
  antiPatternAvoidance: number; // 0-1
  hallucinationCount: number;   // absolute
  composite: number;            // 0-100 weighted
}

export type ErrorCategory =
  | "hallucinated_method"
  | "wrong_params"
  | "missing_env_var"
  | "wrong_flow_order"
  | "incorrect_config"
  | "missing_error_handling"
  | "wrong_import"
  | "security_issue";

export interface EvalResult {
  caseId: string;
  product: string;
  language?: string;
  skillType: "generated" | "hand-crafted";
  withSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  withoutSkill: { output: string; scores: ScoreCard; tokenUsage: TokenUsage };
  delta: number;                // composite difference
  topErrors: ErrorCategory[];   // errors in without-skill arm
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface ProductSummary {
  product: string;
  caseCount: number;
  avgWithSkill: number;
  avgWithoutSkill: number;
  avgDelta: number;
  topErrors: ErrorCategory[];
  skillType?: "generated" | "hand-crafted";
}

export interface EvalReport {
  runId: string;            // ISO timestamp
  model: string;
  totalCases: number;
  results: EvalResult[];
  summary: ProductSummary[];
}

export interface EvalOptions {
  product?: string;
  caseId?: string;
  model: string;
  noCache: boolean;
  dryRun: boolean;
  concurrency: number;
  apiKey: string;
}
```

### API Wrapper (`scripts/eval/api.ts`)

**Pattern to follow**: `scripts/lib/refiner.ts` (the `callAnthropic` function, lines 1-60)

**Overview**: Thin wrapper around the Anthropic Messages API. Reuses the exact fetch pattern from refiner.ts — same headers, same response parsing, same error handling.

```typescript
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const EVAL_MAX_TOKENS = 4096;

export interface GenerateResult {
  output: string;
  usage: TokenUsage;
}

export async function generateCode(
  prompt: string,
  skillContent: string | null,
  options: { apiKey: string; model: string },
): Promise<GenerateResult>
```

**Key decisions**:
- `temperature: 0` for reproducibility (same inputs → same outputs → safe to cache)
- `max_tokens: 4096` (enough for a full code implementation, less than refiner's 8192)
- System prompt has two parts: skill content (if provided) + coding instructions
- The "without skill" arm uses the same coding instructions but no skill prefix

**Implementation steps**:
1. Copy the `fetch()` call pattern from `refiner.ts` (headers, error handling, response parsing)
2. Build system prompt: skill prefix (optional) + fixed coding instruction
3. Parse response to extract both text content and usage stats
4. Add rate limit delay (reuse `rateLimitDelay` pattern — 1s between calls)

### Cache (`scripts/eval/cache.ts`)

**Overview**: Content-addressed file cache to avoid redundant API calls. Key = SHA-256 of `{model}:{system}:{user}`. Stores in `scripts/output/eval-cache/`.

```typescript
export interface CachedResponse {
  output: string;
  usage: TokenUsage;
  model: string;
  cachedAt: string;
}

export function getCacheKey(model: string, system: string, user: string): string
export async function readCache(key: string): Promise<CachedResponse | null>
export async function writeCache(key: string, response: CachedResponse): Promise<void>
```

**Key decisions**:
- File-based cache (no external deps) — one JSON file per cache key in `scripts/output/eval-cache/`
- Cache invalidates naturally when skill content changes (hash includes system prompt with skill content)
- `--no-cache` flag bypasses reads but still writes (so next run is cached)

**Implementation steps**:
1. Hash function using Bun's native `Bun.CryptoHasher` (SHA-256, 16-char hex prefix)
2. Read: try `Bun.file(cachePath).json()`, return null on error
3. Write: `Bun.write(cachePath, JSON.stringify(response))`
4. Ensure `scripts/output/eval-cache/` directory exists on write

### Scorer (`scripts/eval/scorer.ts`)

**Pattern to follow**: `scripts/lib/quality-gate.ts` (rubric-based scoring with issue tracking)

**Overview**: Pure functions that score an LLM output string against expected signals. All deterministic — no API calls.

```typescript
// Core scoring
export function scoreOutput(output: string, expected: ExpectedSignals): ScoreCard
export function categorizeErrors(output: string, expected: ExpectedSignals): ErrorCategory[]

// Building blocks
export function ratioFound(expected: string[], output: string): number
export function scoreFlowOrder(steps: string[], output: string): number
export function countFound(items: string[], output: string): number
export function normalizeForMatch(s: string): string
export function weightedScore(dimensions: Omit<ScoreCard, "composite">): number
```

**Key decisions**:
- `normalizeForMatch()` lowercases and converts between camelCase/snake_case/kebab-case for flexible matching. `getAuthorizationUrl` matches `get_authorization_url` and `get-authorization-url`
- `ratioFound()` returns count_found / total_expected (0 if empty expected array → 1.0, no penalty for empty expectations)
- `scoreFlowOrder()` checks both presence (60% weight) and relative ordering (40% weight) — a step that's present but out of order gets partial credit
- Anti-pattern matching uses substring search — anti-patterns in YAML should be descriptive phrases, not regex
- Hallucination counting uses exact-ish substring match (normalized) — hallucination entries should be specific strings like `workos.sso.authenticate`
- Composite weights: methods(25) + flow(25) + params(15) + envVars(15) + antiPatterns(15) - hallucinations(5 each, cap -25)

**Implementation steps**:
1. Implement `normalizeForMatch()` — lowercase, convert camelCase to snake_case, strip dots/hyphens for comparison
2. Implement `ratioFound()` — iterate expected, check `normalizeForMatch(output).includes(normalizeForMatch(item))`
3. Implement `scoreFlowOrder()` — find position of each flow step keyword in output, check monotonically increasing
4. Implement `countFound()` — same as ratioFound but returns absolute count
5. Implement `weightedScore()` — apply weights, subtract hallucination penalty, clamp 0-100
6. Implement `scoreOutput()` — calls all above, returns ScoreCard
7. Implement `categorizeErrors()` — check each dimension, return list of categories where score < 1.0

**Feedback loop**:
- **Playground**: Create `scripts/tests/eval-scorer.spec.ts` with describe blocks for each function before implementing
- **Experiment**: Test with known code outputs — a "perfect" output that has all expected signals, a "terrible" output with hallucinations and missing methods, and an "average" output. Verify scores: perfect → ~95-100, terrible → <30, average → 50-70
- **Check command**: `bun test --filter eval-scorer`

### Runner (`scripts/eval/runner.ts`)

**Pattern to follow**: `scripts/generate.ts` (orchestration flow: load → process → write)

**Overview**: Orchestrates the full eval: load YAML cases, load skills from disk, call API (or cache), score, aggregate into report.

```typescript
export async function runEval(options: EvalOptions): Promise<EvalReport>
export function loadCases(casesDir: string, filter?: { product?: string; caseId?: string }): EvalCase[]
export function loadSkillContent(skillName: string): string
export function aggregateResults(results: EvalResult[]): ProductSummary[]
```

**Key decisions**:
- `loadCases()` reads all `.yaml` files from `scripts/eval/cases/`, parses with `yaml` package, flattens into `EvalCase[]`
- `loadSkillContent()` checks `HAND_CRAFTED_SKILLS` from config.ts — if hand-crafted, loads `plugins/workos/skills/{name}/SKILL.md`; otherwise concatenates `references/{name}.md` + `references/{name}.guide.md`
- Concurrency: process cases sequentially by default (API rate limits), configurable via `--concurrency`
- Dry-run mode: loads cases and skills, prints table of what would run, exits without API calls
- Results aggregated by product: average with/without scores, average delta, most common error categories

**Implementation steps**:
1. Implement `loadCases()` — glob `scripts/eval/cases/*.yaml`, parse each, flatten, filter by product/caseId
2. Implement `loadSkillContent()` — branch on hand-crafted vs generated, read from disk, concatenate
3. Implement `aggregateResults()` — group by product, compute averages, collect top errors
4. Implement `runEval()` — orchestrate: load cases → for each case: load skill → check cache → call API twice → score → collect results → aggregate → return report
5. Handle dry-run: after loading cases, print summary and return early

**Feedback loop**:
- **Playground**: Create a minimal test YAML case file (`scripts/eval/cases/_test.yaml`) with one case for testing the runner
- **Experiment**: Run `bun run eval -- --dry-run` to verify case loading works. Then run `bun run eval -- --case=sso-node-basic` to verify a single end-to-end flow
- **Check command**: `bun run eval -- --dry-run`

### Reporter (`scripts/eval/reporter.ts`)

**Pattern to follow**: `scripts/output/quality-report.json` (existing JSON report format)

**Overview**: Two output formats: JSON file for machine consumption, console table for human review.

```typescript
export function writeJsonReport(report: EvalReport): Promise<void>
export function printTable(report: EvalReport): void
export function printSummary(report: EvalReport): void
```

**Key decisions**:
- JSON written to `scripts/output/eval-report-{runId}.json`
- Console table uses fixed-width columns with padding (no external table library)
- Summary section at the bottom shows generated vs hand-crafted averages
- Delta column is color-coded in terminal: green for ≥20%, yellow for 10-19%, red for <10%

**Implementation steps**:
1. Implement `writeJsonReport()` — `Bun.write()` to output directory, pretty-printed JSON
2. Implement `printTable()` — format ProductSummary[] as aligned columns with header
3. Implement `printSummary()` — generated avg vs hand-crafted avg, total cost estimate from token usage

### CLI Entrypoint (`scripts/eval.ts`)

**Pattern to follow**: `scripts/generate.ts` (arg parsing and orchestration)

**Overview**: Parses CLI args and calls `runEval()`.

```typescript
function parseArgs(): EvalOptions {
  const args = process.argv.slice(2);
  return {
    product: args.find(a => a.startsWith("--product="))?.split("=")[1],
    caseId: args.find(a => a.startsWith("--case="))?.split("=")[1],
    model: args.find(a => a.startsWith("--model="))?.split("=")[1] ?? "claude-sonnet-4-5-20250929",
    noCache: args.includes("--no-cache"),
    dryRun: args.includes("--dry-run"),
    concurrency: parseInt(args.find(a => a.startsWith("--concurrency="))?.split("=")[1] ?? "1"),
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
  };
}
```

**Implementation steps**:
1. Parse args following `generate.ts` pattern (string split on `=`, `includes()` for flags)
2. Validate: require `ANTHROPIC_API_KEY` unless `--dry-run`
3. Call `runEval(options)`
4. Call `printTable(report)` + `printSummary(report)` + `writeJsonReport(report)`
5. Exit with code 0

## Testing Requirements

### Unit Tests

| Test File | Coverage |
|-----------|----------|
| `scripts/tests/eval-scorer.spec.ts` | All scorer functions |

**Key test cases**:
- `normalizeForMatch()`: camelCase→snake_case, handles dots, handles empty strings
- `ratioFound()`: 0/0 returns 1.0, 3/3 returns 1.0, 1/3 returns 0.33, case-insensitive matching
- `scoreFlowOrder()`: all steps in order → 1.0, all steps reversed → 0.6 (present but wrong order), missing steps → proportional
- `countFound()`: counts exact matches, doesn't double-count overlapping substrings
- `weightedScore()`: perfect scores → 100, zero scores → 0, hallucination penalty capped at 25
- `scoreOutput()`: integration test with realistic code output
- `categorizeErrors()`: maps dimension failures to correct ErrorCategory values

**Test factories**:
```typescript
function makeOutput(overrides?: Partial<{
  methods: string[];
  envVars: string[];
  imports: string[];
  code: string;
}>): string
// Produces a realistic code string containing the specified signals
```

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| Missing ANTHROPIC_API_KEY | Print error message and exit 1 (unless --dry-run) |
| API rate limit (429) | Wait 5s and retry once, then fail the case with error |
| API error (4xx/5xx) | Log error, mark case as failed (score 0), continue with remaining cases |
| YAML parse error | Log error with filename, skip the malformed file, continue |
| Skill file not found | Log warning, skip the case, continue |
| Cache read error | Ignore cache, proceed with fresh API call |
| Empty API response | Mark case as failed (score 0) |

## Validation Commands

```bash
# Unit tests
bun test --filter eval

# Dry run (no API calls)
bun run eval -- --dry-run

# Type checking
bunx tsc --noEmit

# Single case end-to-end (requires ANTHROPIC_API_KEY)
bun run eval -- --case=sso-node-basic
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
