# Implementation Spec: Fix Skill Generation

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

The eval proved that hand-crafted skills work because they're narrow, concrete, and recipe-shaped. Generated skills fail because they're broad, generic, and reference-shaped. The fix is not to restructure — it's to make the generation pipeline produce content that looks more like hand-crafted output.

Five files change in concert: the scorer gets negation-aware anti-pattern matching, the refiner prompt gets a hard 150-line cap with implementation-level tree requirements, the template scaffold gets trimmed to stop producing bloated starting points, the quality gate gets retuned to reward small+concrete over large+comprehensive, and MAX_TOKENS drops to physically cap output.

The changes are validated by re-running the same 12-case eval. The before/after delta comparison is the success metric.

## Feedback Strategy

**Inner-loop command**: `bun test --filter eval`

**Playground**: Test suite for scorer changes. For refiner/template/quality-gate changes, regenerate a single skill (`bun run generate -- --refine-only=workos-sso --force`) and compare output size.

**Why this approach**: Scorer changes are pure functions testable in isolation. Pipeline changes need a real regeneration run to validate.

## File Changes

### Modified Files

| File Path                           | Changes                                                                                                                                                                          |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/eval/scorer.ts`            | Add `isNegated()` helper, update anti-pattern scoring in `scoreOutput()` to skip negated matches                                                                                 |
| `scripts/tests/eval-scorer.spec.ts` | Add tests for `isNegated()` and negation-aware anti-pattern scoring                                                                                                              |
| `scripts/lib/refiner.ts`            | Update `buildRefinePrompt()`: hard 150-line cap, implementation-level tree instruction, bash verification instruction. Reduce `MAX_TOKENS` from 8192 to 4096 for feature guides. |
| `scripts/lib/skill-template.ts`     | Cap `extractSteps()` at 30 lines (was 60). Skip non-actionable headings in extraction. Reduce default "General Flow" to 2 steps.                                                 |
| `scripts/lib/quality-gate.ts`       | Reverse size scoring for guides (reward ≤4KB), add bash verification bonus, add decision tree bonus                                                                              |

## Implementation Details

### 1. Scorer: Negation-Aware Anti-Pattern Matching

**Pattern to follow**: Existing `normalizeForMatch()` in `scripts/eval/scorer.ts`

**Overview**: The `ratioFound()` function currently does bare substring matching. "reject requests without state" matches in text saying "don't reject requests without state." Add a negation check.

```typescript
export function isNegated(output: string, matchIndex: number): boolean {
  const prefix = output
    .slice(Math.max(0, matchIndex - 60), matchIndex)
    .toLowerCase();
  return /\b(don'?t|do not|never|avoid|shouldn'?t|should not|not|without)\s*$/i.test(
    prefix.trim(),
  );
}
```

Update `scoreOutput()` to use a new `negationAwareRatioFound()` for the anti-pattern dimension only:

```typescript
export function negationAwareRatioFound(
  expected: string[],
  output: string,
): number {
  if (expected.length === 0) return 0; // NOTE: 0, not 1 — for antiPatterns, 0 found = good
  const normalizedOutput = normalizeForMatch(output);
  let found = 0;
  for (const item of expected) {
    const normalizedItem = normalizeForMatch(item);
    const idx = normalizedOutput.indexOf(normalizedItem);
    if (idx !== -1 && !isNegated(normalizedOutput, idx)) {
      found++;
    }
  }
  return found / expected.length;
}
```

Then in `scoreOutput()`, change the anti-pattern line:

```typescript
// Before:
const antiPatternAvoidance = 1 - ratioFound(expected.antiPatterns, output);
// After:
const antiPatternAvoidance =
  1 - negationAwareRatioFound(expected.antiPatterns, output);
```

**Feedback loop**:

- **Playground**: Add test cases to `eval-scorer.spec.ts` before implementing
- **Experiment**: Test "don't reject without state" → not flagged. Test "reject without state" → flagged. Test "avoid hardcoded keys" → not flagged. Test "uses hardcoded key sk_live_xxx" → flagged.
- **Check command**: `bun test --filter eval-scorer`

### 2. Refiner Prompt: Leaner, More Concrete

**Pattern to follow**: The existing `buildRefinePrompt()` at `scripts/lib/refiner.ts:297`

**Overview**: Three changes to the feature guide refiner system prompt.

**Change A — Hard line cap**: Replace the soft "Aim for 80-150 lines. If you're over 200 lines, you're restating docs." with:

```
10. Your output MUST be under 150 lines total. This is a HARD LIMIT.
    If you're approaching 150 lines, cut these sections first (in order):
    - Dashboard navigation instructions (agents can find these)
    - Real IdP testing steps (deferred to docs)
    - Launch checklists (redundant with verification)
    - Generic prerequisite sections (SDK install, env var setup — Claude knows these)
    Keep: ONE decision tree, verification bash commands, error recovery (3 cases max), ONE code example.
```

**Change B — Implementation-level trees**: Replace/augment the decision tree instruction with:

```
Decision trees MUST end at a CODE DECISION — which parameter to pass, which method to call, which file to create.
BAD: "Choose between SP-initiated and IdP-initiated" (feature-level — describes the product, not what to code)
GOOD: "How does your app identify the user's org? → email domain: use domainHint param → org selector: use organization param → known connection: use connection param"
Each leaf of the tree should map to a specific SDK parameter, method, or code pattern.
```

**Change C — Concrete bash verification**: Add to the verification section guidance:

```
Verification commands MUST be copy-paste bash one-liners with grep/test/echo for pass/fail:
GOOD: echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing"
GOOD: grep -r "getAuthorizationUrl" src/ || echo "FAIL: No SSO implementation found"
BAD: "Confirm environment variables are set"
BAD: "Test the callback URL works"
BAD: "Go to Dashboard and verify"
```

**Implementation steps**:

1. Read the current `buildRefinePrompt()` system prompt string (lines 307-345)
2. Replace rule 10 (line 342) with the hard cap text
3. Insert the implementation-level tree instruction after rule 4 (line 336)
4. Insert the bash verification instruction after rule 5 (line 337)
5. Keep rules 8 (no SDK method names), 9 (no behavioral claims), and 11 (code example) as-is

### 3. Refiner MAX_TOKENS: Cap Feature Guide Output

**Overview**: Reduce `MAX_TOKENS` from 8192 to 4096 for feature guide refinement only. Routers and API ref guides keep 8192.

In `refineSkill()`, pass a lower max_tokens when the skill type is "guide":

```typescript
const maxTokens = skill.type === "guide" ? 4096 : MAX_TOKENS;
```

Then pass this to `callAnthropic()` (add optional `maxTokens` param).

**Implementation steps**:

1. Add optional `maxTokens` parameter to `callAnthropic()` signature
2. Use it in the JSON body: `max_tokens: maxTokens ?? MAX_TOKENS`
3. In `refineSkill()`, compute `maxTokens` based on skill type and pass it through

### 4. Template Scaffold: Leaner Extraction

**Pattern to follow**: `scripts/lib/skill-template.ts` — `extractSteps()` at line 330

**Overview**: The template extracts too much content from source docs, producing 7-9KB scaffolds. Three changes:

**Change A — Cap `extractSteps()`**: Reduce from 60 to 30 lines max:

```typescript
return steps.slice(0, 30); // was 60
```

**Change B — Skip non-actionable headings**: In `extractSteps()`, skip headings matching common non-actionable patterns:

```typescript
const SKIP_HEADINGS =
  /test.*with.*real|launch.*checklist|optional|admin portal|signing certificate/i;
// In the heading extraction loop:
if (SKIP_HEADINGS.test(currentHeading)) {
  currentHeading = "";
  currentContent = [];
  continue;
}
```

**Change C — Leaner default flow**: Reduce the "General Flow" fallback from 4 steps to 2:

```typescript
lines.push("1. Implement the primary integration pattern");
lines.push("2. Verify with runnable checks");
```

### 5. Quality Gate: Reward What Works

**Pattern to follow**: `scripts/lib/quality-gate.ts` — `scoreGuide()` function

**Overview**: Current scoring rewards size (>1KB = 10pts) and section count (≥4 = 15pts), incentivizing bloat. Retune to reward what the eval proved effective.

**Change A — Reverse size scoring for guides**: Replace the content >1KB check with tiered reverse scoring:

```typescript
// Before: content > 1KB = 10pts
// After:
const sizeKB = skill.sizeBytes / 1024;
if (sizeKB <= 4)
  score += 10; // Sweet spot
else if (sizeKB <= 6)
  score += 7; // Acceptable
else if (sizeKB <= 10) score += 3; // Too large
// >10KB = 0pts
```

**Change B — Bash verification bonus**: Add +5pts for guides with 3+ runnable bash commands (lines starting with `echo`, `grep`, `curl`, `test`, or inside ```bash blocks):

````typescript
const bashCommands =
  (content.match(/^(echo|grep|curl|test -|ls |env \|) /gm) ?? []).length +
  (content.match(/```bash[\s\S]*?```/g) ?? []).length;
if (bashCommands >= 3) score += 5;
````

**Change C — Implementation decision tree bonus**: Add +5pts for code-formatted decision trees (```blocks containing`→`or`-->` patterns):

````typescript
const hasDecisionTree = /```[\s\S]*?(→|-->)[\s\S]*?```/.test(content);
if (hasDecisionTree) score += 5;
````

**Rebalancing**: The new max is 110pts (was 100). Either renormalize to 100 or adjust the pass threshold. Simplest: keep threshold at 70, accept that max is now 110. Skills that score well on the new criteria get bonus points.

**Implementation steps**:

1. Find the `scoreGuide()` function
2. Replace the size check with tiered reverse scoring
3. Add bash verification bonus after the verification section check
4. Add decision tree bonus after the code example check
5. Run `bun test --filter quality` to ensure existing tests still make sense (some may need threshold updates)

## Testing Requirements

### Unit Tests

| Test File                           | Coverage                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/tests/eval-scorer.spec.ts` | `isNegated()`, `negationAwareRatioFound()`, updated `scoreOutput()` anti-pattern tests |

**Key test cases**:

- `isNegated()`: "don't reject" → true, "do not use" → true, "never hardcode" → true, "uses hardcoded" → false, "without verification" at start of text → false (no preceding negation)
- `negationAwareRatioFound()`: "Don't reject requests without state" + antiPattern "reject requests without state" → 0 (not found due to negation)
- `negationAwareRatioFound()`: "You should reject requests without state" + same antiPattern → 1 (found, no negation)
- `scoreOutput()` integration: with-skill SSO idp-initiated case should no longer lose points on anti-pattern

### Integration Testing (manual)

- [ ] `bun run generate -- --refine-only=workos-sso --force` produces a guide ≤5KB
- [ ] Regenerated SSO guide has implementation-level decision trees (param choice, not flow choice)
- [ ] Regenerated SSO guide has bash verification commands (grep/echo, not prose)
- [ ] Quality gate passes for regenerated SSO skill
- [ ] `bun run eval` shows improved SSO delta (was -5%)

## Error Handling

| Error Scenario                            | Handling Strategy                                                     |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Regenerated skills fail quality gate      | Adjust quality gate thresholds — the new scoring may need calibration |
| Truncated guide output (4096 token cap)   | Check if guide ends mid-sentence; if so, bump to 5120 tokens          |
| Existing tests break from scoring changes | Update test expectations to match new scoring rubric                  |

## Validation Commands

```bash
# Unit tests (scorer + quality gate)
bun test --filter eval
bun test --filter quality

# Full test suite
bun test

# Regenerate one skill to test pipeline
bun run generate -- --refine-only=workos-sso --force

# Check regenerated guide size
wc -c plugins/workos/skills/workos/references/workos-sso.guide.md

# Re-run eval (requires ANTHROPIC_API_KEY, uses --no-cache to force fresh generation)
bun run eval -- --no-cache
```

---

_This spec is ready for implementation. Changes are tightly coupled — implement scorer fix first (independent), then pipeline changes together, then re-run eval to validate._
