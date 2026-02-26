# Implementation Spec: Skill Quality Framework - Phase 2

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

This phase applies the framework built in Phase 1. Three steps: migrate existing `.rules.yml` files to `.feedback.md` format, re-refine all 33 generated skills through the updated pipeline, and validate the results. The migration is mostly mechanical — existing regex rules encode domain knowledge that translates directly to natural language corrections. The re-refinement is a full `generate --refine --force` run, which will produce new skill content following the content taxonomy. Validation confirms skills pass both the updated deterministic quality gate and the LLM semantic check.

Key risk: re-refinement may produce skills that are too thin (over-deferring to docs) or that lose valuable trap warnings from the current versions. Mitigation: before the bulk re-refine, run a single skill (dsync) through the pipeline and review the output manually. Adjust refiner prompts if needed before running the full batch.

## Feedback Strategy

**Inner-loop command**: `bun run generate -- --refine-only=workos-directory-sync`

**Playground**: Single-skill refinement loop — refine dsync, review output, adjust prompts, repeat until quality is right before running the full batch.

**Why this approach**: The refiner prompt quality is the single biggest factor in output quality. Iterating on one skill is much faster than running all 33 each time.

## File Changes

### New Files

| File Path                                                         | Purpose                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `skills/workos/workos-directory-sync.feedback.md`                 | Migrated from `.rules.yml` — dsync corrections             |
| `skills/workos/workos-migrate-aws-cognito.feedback.md`            | Migrated from `.rules.yml` — Cognito corrections           |
| `skills/workos/workos-migrate-descope.feedback.md`                | Migrated from `.rules.yml` — Descope corrections           |
| `skills/workos/workos-migrate-other-services.feedback.md`         | Migrated from `.rules.yml` — generic migration corrections |
| `skills/workos/workos-migrate-the-standalone-sso-api.feedback.md` | Migrated from `.rules.yml` — SSO API migration corrections |

### Modified Files

| File Path                     | Changes                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `scripts/lib/quality-gate.ts` | Promote semantic check failures from warning to hard block    |
| `scripts/tests/rules.spec.ts` | Update or remove tests that depend on old `.rules.yml` format |

### Deleted Files

| File Path                                                       | Reason                          |
| --------------------------------------------------------------- | ------------------------------- |
| `skills/workos/workos-directory-sync.rules.yml`                 | Replaced by `.feedback.md`      |
| `skills/workos/workos-migrate-aws-cognito.rules.yml`            | Replaced by `.feedback.md`      |
| `skills/workos/workos-migrate-descope.rules.yml`                | Replaced by `.feedback.md`      |
| `skills/workos/workos-migrate-other-services.rules.yml`         | Replaced by `.feedback.md`      |
| `skills/workos/workos-migrate-the-standalone-sso-api.rules.yml` | Replaced by `.feedback.md`      |
| `scripts/lib/rules.ts`                                          | Fully replaced by `feedback.ts` |

## Implementation Details

### 1. Migrate `.rules.yml` → `.feedback.md`

**Overview**: Convert each existing rules file to natural language feedback format. The corrections are already encoded in the `context` fields — they just need to be extracted and written as prose.

**Migration mapping**:

| `.rules.yml` field           | `.feedback.md` equivalent          |
| ---------------------------- | ---------------------------------- |
| `must_contain[].context`     | Emphasis item ("SHOULD highlight") |
| `must_not_contain[].context` | Correction ("MUST NOT claim")      |
| `description`                | Section heading context            |

**Example migration (workos-directory-sync)**:

From:

```yaml
rules:
  - id: dsync-event-delivery
    description: "Directory Sync supports both webhooks (recommended) and Events API polling"
    must_contain:
      - pattern: "webhook"
        context: "Must mention webhooks as the primary event delivery mechanism"
      - pattern: "events api|events.listEvents|polling|poll"
        context: "Must acknowledge the Events API as a valid alternative to webhooks"
    must_not_contain:
      - pattern: "polling is not supported|cannot poll|you cannot poll"
        context: "Polling IS supported via the Events API — do not claim otherwise"
      - pattern: "webhooks?.*(are|is) mandatory|webhooks?.*(are|is) required"
        context: "Webhooks are recommended, not mandatory — the Events API is a valid alternative"
```

To:

```markdown
# Feedback for workos-directory-sync

## Corrections

- WorkOS supports both webhooks AND the Events API for directory sync events.
  Do not claim webhooks are mandatory or that polling is not supported.
- Webhooks are the recommended approach for real-time sync, but the Events API
  (workos.events.listEvents()) is a valid alternative for batch processing,
  data reconciliation, or recovering missed events.

## Emphasis

- Mention webhooks as the primary event delivery mechanism
- Acknowledge the Events API as a valid alternative to webhooks
```

**Implementation steps**:

1. Read each existing `.rules.yml` file
2. Extract `must_not_contain[].context` → Corrections
3. Extract `must_contain[].context` → Emphasis
4. Write `.feedback.md` with proper formatting
5. Delete `.rules.yml` files
6. Delete `scripts/lib/rules.ts`
7. Update `scripts/tests/rules.spec.ts` → rename to `scripts/tests/feedback.spec.ts` or update to test new system

### 2. Single-Skill Validation (dsync)

**Overview**: Before bulk re-refinement, run dsync through the new pipeline and manually review. This validates the refiner prompts produce good output.

**Implementation steps**:

1. Run: `bun run generate -- --refine-only=workos-directory-sync --force`
2. Review `skills/workos/workos-directory-sync.md` output:
   - Does it follow the content taxonomy? (structural facts only, behavioral claims deferred)
   - Are feedback corrections respected? (no "webhooks mandatory" claim)
   - Does it retain trap warnings? (dsync.deleted doesn't trigger individual deletes)
   - Is it a reasonable size? (target: 150-300 lines)
   - Does it still have decision trees, verification, error recovery?
3. If output quality is poor, adjust refiner prompts in Phase 1 code and repeat
4. Iterate until dsync output is satisfactory

### 3. Bulk Re-Refinement

**Overview**: Once dsync validates well, run the full pipeline for all 33 generated skills.

**Implementation steps**:

1. Run: `bun run generate -- --refine --force`
2. Review quality gate report: `scripts/output/quality-report.json`
3. Check for:
   - All skills pass deterministic quality gate (score ≥ 70)
   - Skills with feedback pass LLM semantic check
   - No skills contain behavioral assertion patterns flagged by the new criteria
4. Spot-check 3-5 skills manually (pick different types: feature, API ref, migration)
5. If widespread issues, adjust refiner prompts and re-run

### 4. Promote Semantic Check to Hard Block

**Overview**: After validation confirms the LLM semantic check works correctly, promote its failures from warnings to hard blocks in the quality gate.

**Implementation steps**:

1. Update `quality-gate.ts`: change semantic check from warning to error severity
2. Update tests to reflect the promotion
3. Verify: `bun test`

### 5. Clean Up Rules System

**Overview**: Remove the old rules system entirely now that feedback has replaced it.

**Implementation steps**:

1. Remove `scripts/lib/rules.ts`
2. Remove all `loadRules`/`evaluateRules`/`formatRulesForPrompt` imports from `quality-gate.ts` and `refiner.ts`
3. Remove or update `scripts/tests/rules.spec.ts`
4. Update `README.md` to document `.feedback.md` instead of `.rules.yml`
5. Verify: `bun test`

## Testing Requirements

### Unit Tests

| Test File                            | Coverage                                        |
| ------------------------------------ | ----------------------------------------------- |
| `scripts/tests/feedback.spec.ts`     | Loading migrated feedback files works correctly |
| `scripts/tests/quality-gate.spec.ts` | Semantic check promoted to hard block           |

**Key test cases**:

- Migrated feedback files load correctly
- `loadFeedback("workos-directory-sync")` returns expected corrections and emphasis
- Quality gate fails skills with semantic check violations (after promotion)
- Quality gate still passes skills without feedback (no semantic check needed)

### Manual Testing

- [ ] dsync single-skill re-refinement produces quality output
- [ ] Spot-check 3-5 bulk-refined skills for content taxonomy adherence
- [ ] Quality report shows all skills passing
- [ ] No `.rules.yml` files remain
- [ ] `bun test` passes with all changes

## Error Handling

| Error Scenario                                  | Handling Strategy                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| Re-refinement produces empty skill              | Quality gate catches (content length < 500B), logged in report              |
| Re-refinement loses critical trap warnings      | Manual review step (2.2) catches this before bulk run                       |
| LLM semantic check rate limited during bulk run | Existing rate limit delay (1000ms) in refiner applies; retry logic for 429s |
| Bulk re-refine takes too long                   | Expected: ~33 skills × ~10s each = ~6 min. Acceptable.                      |

## Validation Commands

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Format
bun run format:check

# Single-skill re-refine (validation)
bun run generate -- --refine-only=workos-directory-sync --force

# Full re-refine
bun run generate -- --refine --force

# Check quality report
cat scripts/output/quality-report.json | bun -e '
const report = JSON.parse(await Bun.stdin.text());
const failed = report.filter(s => !s.pass);
console.log(`${report.length} skills scored, ${failed.length} failed`);
failed.forEach(s => console.log(`  FAIL: ${s.name} (${s.score})`));
'

# Verify no .rules.yml files remain
ls skills/workos/*.rules.yml 2>/dev/null && echo "FAIL: rules files still exist" || echo "PASS: rules files removed"

# Verify feedback files exist
ls skills/workos/*.feedback.md
```

## Open Items

- [ ] Decide whether to keep `rules.ts` as deprecated backward compat or clean-delete. Recommendation: clean-delete since we haven't shipped.

---

_This spec is ready for implementation. Follow the patterns and validate at each step._
