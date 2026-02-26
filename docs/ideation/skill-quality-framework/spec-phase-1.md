# Implementation Spec: Skill Quality Framework - Phase 1

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

This phase builds the three core components: feedback mechanism, refiner prompt overhaul, and quality gate evolution. The strategy is to work from the inside out — define the feedback format first, then update the refiner to consume it, then update the quality gate to validate against it.

The refiner is the highest-leverage change point. The generator templates stay as-is — they produce scaffolds that the refiner transforms. By concentrating the content philosophy in the refiner prompts, we get a single point of control for what "good" looks like. The quality gate becomes the enforcement layer, with deterministic checks on every run and an LLM semantic check when `--refine` is used.

Key design decision: feedback files are plain markdown, not YAML. Domain experts like Pavan shouldn't need to learn a schema to say "this claim is wrong." The loading code extracts corrections from markdown list items.

## Feedback Strategy

**Inner-loop command**: `bun test scripts/tests/feedback.spec.ts scripts/tests/quality-gate.spec.ts`

**Playground**: Test suite — most changes are to pipeline library code with clear inputs/outputs.

**Why this approach**: Every component (feedback loader, refiner prompts, quality gate) has deterministic behavior that's best validated through unit tests.

## File Changes

### New Files

| File Path                        | Purpose                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `scripts/lib/feedback.ts`        | Load and format `.feedback.md` files for refiner injection |
| `scripts/tests/feedback.spec.ts` | Tests for feedback loading and formatting                  |

### Modified Files

| File Path                            | Changes                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `scripts/lib/refiner.ts`             | Overhaul all 3 prompt builders with content taxonomy + feedback injection |
| `scripts/lib/quality-gate.ts`        | Update deterministic criteria + add LLM semantic check                    |
| `scripts/lib/types.ts`               | Add `SkillFeedback` type, `SemanticCheckResult` type                      |
| `scripts/tests/quality-gate.spec.ts` | Update tests for new criteria + mock LLM check                            |
| `scripts/generate.ts`                | Pass `--refine` flag context to quality gate for LLM check                |

### Deleted Files

None in this phase. `.rules.yml` files and `rules.ts` are migrated/removed in Phase 2.

## Implementation Details

### 1. Feedback Mechanism (`scripts/lib/feedback.ts`)

**Pattern to follow**: `scripts/lib/rules.ts` (same load-from-disk pattern, simpler format)

**Overview**: Load per-skill `.feedback.md` files containing natural language corrections from domain experts. Format them for injection into refiner prompts.

```typescript
// File format: skills/workos/{skill-name}.feedback.md
// Content: markdown with corrections as list items under headings
//
// Example:
// # Feedback for workos-directory-sync
//
// ## Corrections
// - WorkOS supports both webhooks AND the Events API for directory sync.
//   Do not claim webhooks are mandatory or that polling is not supported.
// - The Events API (workos.events.listEvents()) is a valid alternative
//   for batch processing, data reconciliation, or recovering missed events.
//
// ## Emphasis
// - The dsync.deleted event does NOT trigger individual user/group delete
//   events. This is a common trap — emphasize it.

export interface SkillFeedback {
  corrections: string[];
  emphasis: string[];
}

/**
 * Load feedback from skills/workos/{skillName}.feedback.md.
 * Returns empty feedback if no file exists.
 */
export function loadFeedback(skillName: string): SkillFeedback;

/**
 * Format feedback as constraint text for refiner prompts.
 * Returns empty string if no feedback exists.
 */
export function formatFeedbackForPrompt(feedback: SkillFeedback): string;
```

**Key decisions**:

- Markdown format (not YAML) — lowest barrier for domain experts
- Two sections: "Corrections" (things the skill gets wrong) and "Emphasis" (things the skill should highlight more)
- Corrections are injected as hard constraints ("MUST respect"). Emphasis items are softer ("SHOULD highlight")
- Parser extracts list items under `## Corrections` and `## Emphasis` headings

**Implementation steps**:

1. Create `scripts/lib/feedback.ts` with `loadFeedback()` and `formatFeedbackForPrompt()`
2. `loadFeedback()` reads `skills/workos/${skillName}.feedback.md`, parses markdown list items under known headings
3. `formatFeedbackForPrompt()` formats as a prompt section with MUST/SHOULD language
4. Handle edge cases: missing file, empty file, file with no recognized headings

**Feedback loop**:

- **Playground**: Create `scripts/tests/feedback.spec.ts` with test cases for loading and formatting
- **Experiment**: Test with valid feedback file, empty file, missing file, malformed markdown
- **Check command**: `bun test scripts/tests/feedback.spec.ts`

### 2. Refiner Prompt Overhaul (`scripts/lib/refiner.ts`)

**Pattern to follow**: Existing `buildRefinePrompt()`, `buildApiRefRefinePrompt()`, `buildRouterRefinePrompt()` — same structure, updated content.

**Overview**: Update all three prompt builders to encode the content taxonomy and inject feedback. The core change is replacing "transform doc prose into procedural steps" with a precise taxonomy of what to bake in vs defer to docs.

**Key changes to the system prompt (shared across all 3 builders)**:

```markdown
## Content Taxonomy (CRITICAL)

Your output MUST follow this taxonomy. Violations will be caught by the quality gate.

### SAFE to include (structural vocabulary + architectural decisions)

- Concept names: "organization", "connection", "directory", "role slug"
- ID prefixes and env var names: `sk_`, `WORKOS_API_KEY`
- Event type naming conventions: `{domain}.{resource}.{action}`
- Dashboard navigation paths
- Architectural patterns: "use upsert", "return 200 immediately", "verify signature before processing"
- Decision trees for choosing between approaches
- Trap warnings: things agents will get wrong without explicit guidance
- Verification commands: bash one-liners to confirm setup

### MUST DEFER to docs (behavioral claims + API surface details)

- Behavioral assertions: "X is required", "Y is not supported", "Z is mandatory"
  → Instead write: "Check fetched docs for [specific question]"
- Exact SDK method signatures (vary by language/version)
  → Instead write: "Use the SDK method for [operation] — check fetched docs for exact signature"
- Complete request/response schemas
- Error code tables and rate limits
- Complete code implementations
  → Instead provide pseudocode showing the PATTERN, not exact code
- Any claim with "always", "never", "only", "must" about API behavior

### The test: "Would this sentence become wrong if the docs changed?"

If yes → defer to docs. If no (it's a pattern, decision, or structural fact) → safe to include.
```

**Changes per prompt builder**:

1. **`buildRefinePrompt()`** (feature skills):
   - Replace gold standard analysis instructions with content taxonomy
   - Add feedback injection point after taxonomy
   - Update rule 10: "aim for 2-5KB of procedural content" → "aim for 150-300 lines of procedural guidance with structural vocabulary"
   - Add: "Replace complete code examples with pseudocode patterns. Show WHAT to do, not exact HOW"
   - Replace rules injection (`formatRulesForPrompt`) with feedback injection (`formatFeedbackForPrompt`)

2. **`buildApiRefRefinePrompt()`** (API reference skills):
   - Add content taxonomy
   - Strengthen: "Endpoint catalog (method + path + purpose) is structural — keep it. Request/response schemas are behavioral — defer to docs"
   - Add: "Show the operation decision tree, not the full schema"
   - Replace rules injection with feedback injection

3. **`buildRouterRefinePrompt()`** (router skill):
   - Add content taxonomy (mostly for completeness — router is already 100% procedural)
   - Replace rules injection with feedback injection

**Shared changes**:

- Update `getAttributionBlock()`: remove "webhooks are mandatory" example, strengthen "defer to docs" language
- Add new shared function `getContentTaxonomyBlock(): string` that returns the taxonomy text
- Replace all `loadRules`/`formatRulesForPrompt` calls with `loadFeedback`/`formatFeedbackForPrompt`

**Implementation steps**:

1. Add `getContentTaxonomyBlock()` to refiner.ts
2. Update `getAttributionBlock()` to remove stale examples and strengthen doc-deferral language
3. Update `buildRefinePrompt()` — inject taxonomy + feedback, update instructions
4. Update `buildApiRefRefinePrompt()` — inject taxonomy + feedback, update instructions
5. Update `buildRouterRefinePrompt()` — inject taxonomy + feedback
6. Update imports: replace `loadRules`/`formatRulesForPrompt` with `loadFeedback`/`formatFeedbackForPrompt`

**Feedback loop**:

- **Playground**: Manual review of prompt output — use a test script that prints the full prompt for a given skill
- **Experiment**: Generate prompts for dsync (feature), api-sso (API ref), and workos (router). Verify taxonomy and feedback are present
- **Check command**: `bun -e 'import { ... } from "./scripts/lib/refiner.ts"; ...'` (inline script to print a prompt)

### 3. Quality Gate Evolution (`scripts/lib/quality-gate.ts`)

**Pattern to follow**: Existing `scoreSkill()` function structure.

**Overview**: Two changes: (a) update deterministic scoring criteria to align with the new philosophy, (b) add an LLM-based semantic check that runs only when `--refine` is passed.

**Deterministic criteria updates**:

| Check                               | Current                         | Updated                                                                                                                                                             |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doc URL references (20pts)          | 3+ WorkOS doc URLs              | Keep as-is                                                                                                                                                          |
| No doc dump (15pts)                 | No blocks >2KB                  | Reduce threshold: no code blocks >40 lines, no single example >1KB                                                                                                  |
| Excessive "check docs" (penalty)    | Warns if >3 deferrals           | **Remove this penalty** — we now WANT doc deferrals                                                                                                                 |
| New: Behavioral claim check (10pts) | N/A                             | Deduct points for behavioral assertion patterns: "is required", "is mandatory", "is not supported", "must use", "only supports" without "check fetched docs" nearby |
| Verification/Error (15pts)          | Has checklist OR error recovery | Keep as-is                                                                                                                                                          |

**New: LLM semantic check** (runs only with `--refine`):

```typescript
export interface SemanticCheckResult {
  pass: boolean;
  violations: string[]; // Natural language descriptions
  score: number; // 0-100
}

/**
 * Run LLM-based semantic validation on a refined skill.
 * Checks: (a) feedback corrections respected, (b) behavioral claims deferred to docs.
 * Only called when --refine flag is active.
 */
export async function semanticQualityCheck(
  skillContent: string,
  feedback: SkillFeedback,
  options: { apiKey: string; model?: string },
): Promise<SemanticCheckResult>;
```

**LLM check prompt design**:

- System: "You are a skill quality auditor. Check this skill against the corrections and content taxonomy."
- User: skill content + feedback corrections + taxonomy summary
- Ask the LLM to return JSON: `{ pass: boolean, violations: string[], score: number }`
- Use a cheaper/faster model (Haiku or Sonnet) — this is validation, not generation
- Parse response, handle malformed JSON gracefully

**Integration with pipeline**:

- `generate.ts` passes a `refineMode: boolean` flag to the quality gate
- Quality gate calls `semanticQualityCheck()` only when `refineMode === true` AND the skill has feedback
- Semantic check failures are logged as warnings (not hard blocks) in Phase 1 — promoted to blocks after validation in Phase 2

**Implementation steps**:

1. Add `SemanticCheckResult` type to `types.ts`
2. Update `scoreSkill()` deterministic criteria: remove "excessive check docs" penalty, add behavioral claim check, tighten code block limits
3. Implement `semanticQualityCheck()` — LLM call with structured prompt
4. Wire into `scoreSkill()`: call semantic check when `refineMode` flag is set
5. Update `generate.ts` to pass refine flag to quality gate
6. Update quality gate tests

**Feedback loop**:

- **Playground**: Create test cases with known-good and known-bad skill content
- **Experiment**: Test semantic check with: (a) skill that respects feedback, (b) skill that violates feedback, (c) skill with behavioral assertions, (d) skill with no feedback
- **Check command**: `bun test scripts/tests/quality-gate.spec.ts`

### 4. Type Updates (`scripts/lib/types.ts`)

**Overview**: Add types for the new feedback and semantic check systems.

```typescript
// Add to existing types.ts

export interface SkillFeedback {
  corrections: string[];
  emphasis: string[];
}

export interface SemanticCheckResult {
  pass: boolean;
  violations: string[];
  score: number;
}
```

**Implementation steps**:

1. Add `SkillFeedback` interface
2. Add `SemanticCheckResult` interface

## Testing Requirements

### Unit Tests

| Test File                            | Coverage                                                |
| ------------------------------------ | ------------------------------------------------------- |
| `scripts/tests/feedback.spec.ts`     | Feedback loading, parsing, formatting                   |
| `scripts/tests/quality-gate.spec.ts` | Updated deterministic criteria, semantic check (mocked) |

**Key test cases for feedback**:

- Loads corrections and emphasis from valid `.feedback.md`
- Returns empty arrays for missing file
- Returns empty arrays for empty file
- Handles markdown without recognized headings
- `formatFeedbackForPrompt()` produces MUST/SHOULD language
- `formatFeedbackForPrompt()` returns empty string for no feedback

**Key test cases for quality gate**:

- Behavioral claim patterns detected and penalized
- "Check fetched docs" nearby negates behavioral claim penalty
- Large code blocks (>40 lines) penalized
- "Excessive check docs" penalty removed (no longer applies)
- Semantic check returns pass for clean skill (mocked LLM)
- Semantic check returns violations for skill ignoring feedback (mocked LLM)

## Error Handling

| Error Scenario                            | Handling Strategy                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `.feedback.md` has invalid markdown       | Return empty feedback, log warning                                        |
| LLM semantic check API call fails         | Log warning, skip semantic check (don't block pipeline)                   |
| LLM returns malformed JSON                | Parse best-effort, default to `{ pass: true, violations: [], score: 50 }` |
| No ANTHROPIC_API_KEY when `--refine` used | Existing behavior: throw error (API key required for refinement)          |

## Validation Commands

```bash
# Run all tests
bun test

# Run only new/changed tests
bun test scripts/tests/feedback.spec.ts scripts/tests/quality-gate.spec.ts

# Type checking
bunx tsc --noEmit

# Format check
bun run format:check

# Smoke test: print refiner prompt for dsync to verify taxonomy injection
bun -e '
import { readFileSync } from "fs";
const refiner = await import("./scripts/lib/refiner.ts");
// Verify the prompt includes content taxonomy and feedback sections
'
```

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
