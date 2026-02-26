# Implementation Spec: Progressive Disclosure for Generated Skills

**Contract**: ./contract.md
**Estimated Effort**: M

## Technical Approach

Work inside-out: types first, then template rendering, then generator, then refiner integration, then quality gate, then orchestrator. Each layer builds on the previous. The key insight is that `renderSkill()` already produces sectioned content — we split it into two render functions that divide the same sections between summary and guide.

The refiner gets a new summary prompt builder that focuses on extracting structural vocabulary and key concepts. The guide prompt is the existing feature/API-ref/router prompt unchanged. Both files share the same source hash for content-addressed locking.

## Feedback Strategy

**Inner-loop command**: `bun test scripts/tests/generator.spec.ts scripts/tests/quality-gate.spec.ts`

**Playground**: Test suite — most changes produce deterministic output testable through unit tests.

## File Changes

### Modified Files

| File Path                            | Changes                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| `scripts/lib/types.ts`               | Add `type?: 'summary' \| 'guide'` to `GeneratedSkill`           |
| `scripts/lib/skill-template.ts`      | Add `renderSummary()`, rename `renderSkill()` → `renderGuide()` |
| `scripts/lib/generator.ts`           | `generateSkill()` returns `[summary, guide]` pair               |
| `scripts/lib/refiner.ts`             | Add `buildSummaryRefinePrompt()`, route by skill type           |
| `scripts/lib/quality-gate.ts`        | Separate scoring for summary vs guide                           |
| `scripts/lib/config.ts`              | Add `SUMMARY_VALIDATION` size constraints                       |
| `scripts/generate.ts`                | Handle dual-file generation, refinement routing, write both     |
| `scripts/tests/generator.spec.ts`    | Update for dual-file output                                     |
| `scripts/tests/quality-gate.spec.ts` | Add summary scoring tests                                       |

## Implementation Details

### 1. Type Updates (`scripts/lib/types.ts`)

**Pattern to follow**: existing `GeneratedSkill` interface

Add a `type` field to distinguish summary from guide:

```typescript
export interface GeneratedSkill {
  name: string;
  path: string;
  content: string;
  sizeBytes: number;
  generated: boolean;
  sourceHash?: string;
  /** 'summary' for the lightweight overview, 'guide' for full implementation */
  type?: "summary" | "guide";
}
```

**Implementation steps**:

1. Add `type?: 'summary' | 'guide'` to `GeneratedSkill`

### 2. Skill Template Split (`scripts/lib/skill-template.ts`)

**Pattern to follow**: existing `renderSkill()` function structure

**Overview**: Split the current monolithic render into two functions. The summary gets the "what" sections, the guide gets the "how" sections.

**New function — `renderSummary(spec, sourceHash)`**:

Returns markdown with:

- Frontmatter (name, description)
- Content-addressed marker
- Title
- `## When to Use` — extracted intro (existing `extractIntro()`)
- `## Documentation` — list of doc URLs for reference
- `## Key Concepts` — placeholder section (populated by refiner)
- `## Implementation Guide` — pointer: `→ Read skills/workos/{name}.guide.md`
- `## Related Skills` — existing `renderRelatedSkills()`

**Rename `renderSkill()` → `renderGuide(spec, sourceHash)`**:

Returns markdown with (NO frontmatter — guide is not a standalone skill):

- Content-addressed marker
- Title with "— Implementation Guide" suffix
- `## Step 1: Fetch Documentation` — existing `renderDocFetchSection()`
- `## Prerequisites` — existing `renderPrerequisites()`
- `## Implementation Guide` — existing `renderImplementationGuide()`
- `## Verification Checklist` — existing `renderVerificationChecklist()`
- `## Error Recovery` — existing `renderErrorRecovery()`

**Implementation steps**:

1. Create `renderSummary(spec, sourceHash)` function
2. Rename `renderSkill()` to `renderGuide()`
3. Remove frontmatter and related skills from guide output
4. Remove implementation/verification/error sections from summary
5. Add "Key Concepts" placeholder section to summary
6. Add guide pointer to summary: `→ Read skills/workos/{name}.guide.md`

**Feedback loop**:

- **Check command**: `bun test scripts/tests/generator.spec.ts`

### 3. Generator Dual Output (`scripts/lib/generator.ts`)

**Pattern to follow**: existing `generateSkill()` function

**Overview**: `generateSkill()` returns an array of two `GeneratedSkill` objects instead of one.

**Changes**:

```typescript
// Before
export function generateSkill(spec: SkillSpec): GeneratedSkill;

// After
export function generateSkill(
  spec: SkillSpec,
): [GeneratedSkill, GeneratedSkill];
// Returns [summary, guide]
```

- Summary: `path: skills/workos/${name}.md`, `type: 'summary'`
- Guide: `path: skills/workos/${name}.guide.md`, `type: 'guide'`
- Both share the same `sourceHash`

Router generation (`generateRouter`, `generateIntegrationRouter`) unchanged — these are single-file skills.

**Implementation steps**:

1. Update `generateSkill()` to call both `renderSummary()` and `renderGuide()`
2. Return `[summary, guide]` tuple
3. Set `type: 'summary'` and `type: 'guide'` respectively
4. Guide path uses `.guide.md` extension
5. Update `generate.ts` to flatten the array of pairs into the `generatedSkills` list

**Feedback loop**:

- **Check command**: `bun test scripts/tests/generator.spec.ts`

### 4. Refiner Integration (`scripts/lib/refiner.ts`)

**Pattern to follow**: existing `buildRefinePrompt()` function

**Overview**: Add a summary-specific refine prompt. The refiner routes by skill type: summaries get the summary prompt, guides get the existing feature/API-ref/router prompts.

**New function — `buildSummaryRefinePrompt(skillName, frontmatter, body)`**:

System prompt focuses on:

- Extract key structural vocabulary (concept names, ID prefixes, event naming patterns)
- Write a concise "Key Concepts" section with the content taxonomy's "SAFE to include" items
- Keep the summary under 2KB
- Do NOT add implementation steps, verification, or error recovery
- Preserve the guide pointer exactly

**Changes to `refineSkill()`**:

```typescript
// Route by type
const isSummary = skill.type === 'summary';
const prompt = isSummary
  ? buildSummaryRefinePrompt(skillName, frontmatter, body)
  : isRouter
    ? buildRouterRefinePrompt(...)
    : isApiRef
      ? buildApiRefRefinePrompt(...)
      : buildRefinePrompt(...);
```

**Implementation steps**:

1. Add `buildSummaryRefinePrompt()` with structural vocabulary extraction instructions
2. Update `refineSkill()` to check `skill.type` and route to the summary prompt
3. Inject content taxonomy block into summary prompt (reuse `getContentTaxonomyBlock()`)
4. Inject feedback via `loadFeedback()`/`formatFeedbackForPrompt()` into summary prompt

### 5. Quality Gate Scoring (`scripts/lib/quality-gate.ts`)

**Pattern to follow**: existing `scoreSkill()` function

**Overview**: Summaries and guides have different scoring criteria.

**Summary scoring (100 points)**:

| Check                                                     | Points |
| --------------------------------------------------------- | ------ |
| Valid frontmatter with name + description                 | 20     |
| Has generated/refined marker                              | 5      |
| Has "When to Use" section                                 | 15     |
| Has "Key Concepts" section with content                   | 15     |
| Has guide pointer (matches `Read skills/workos/` pattern) | 15     |
| Has doc URL references (1+)                               | 15     |
| Has "Related Skills" section                              | 5      |
| Size under 3KB                                            | 10     |

**Guide scoring**: existing criteria unchanged (frontmatter check removed since guides don't have frontmatter — replace with marker check worth 20pts).

Update the guide scoring:

| Check                                              | Points      |
| -------------------------------------------------- | ----------- |
| Has generated/refined marker                       | 10          |
| Has doc URL references (3+)                        | 20          |
| Has 4+ structural sections                         | 15          |
| Content > 1KB                                      | 10          |
| Has verification or error recovery                 | 15          |
| No doc dump (code blocks <40 lines, examples <1KB) | 15          |
| No frontmatter (guides shouldn't have it)          | 5           |
| Behavioral claim check                             | -10 penalty |

Semantic check runs on BOTH summaries and guides (summaries checked for feedback respect too).

**Implementation steps**:

1. Add `scoreSummary()` function with summary-specific criteria
2. Rename existing `scoreSkill()` to `scoreGuide()`
3. Route in `scoreSkill()` dispatcher based on `skill.type`
4. Update guide scoring to not require frontmatter
5. Add tests for summary scoring

**Feedback loop**:

- **Check command**: `bun test scripts/tests/quality-gate.spec.ts`

### 6. Orchestrator Updates (`scripts/generate.ts`)

**Pattern to follow**: existing generation loop

**Overview**: Handle the tuple return from `generateSkill()`, flatten into the skills array, and ensure refinement/writing/quality-gate all handle both types.

**Changes**:

1. **Generation phase**: `generateSkill()` now returns `[summary, guide]`. Flatten:

   ```typescript
   const [summary, guide] = generateSkill(spec);
   generatedSkills.push(summary, guide);
   ```

2. **Refinement phase**: Refine all skills (summaries + guides). The refiner routes by type internally.

3. **Write phase**: Write both files. Content-addressed locking works independently on each.

4. **Quality gate phase**: Evaluate both summaries and guides.

5. **`--refine-only` scoping**: When targeting a skill name, match both the summary and guide:

   ```typescript
   if (flags.refineOnly && !skill.name.startsWith(flags.refineOnly)) {
     // skip
   }
   ```

   Both `workos-sso` (summary) and `workos-sso` (guide) match since they share the same `name`.

6. **Logging**: Differentiate summary vs guide in console output.

**Implementation steps**:

1. Update generation loop to destructure tuples and flatten
2. Verify refinement handles both types (routing is internal to refiner)
3. Update write phase logging to show type
4. Update `--refine-only` filter to match both summary and guide by name
5. Update quality gate invocation (no changes needed — it processes whatever's in the array)

### 7. Config Updates (`scripts/lib/config.ts`)

**Implementation steps**:

1. Add summary validation constants:
   ```typescript
   export const SUMMARY_VALIDATION = {
     minSize: 200,
     maxSize: 3072, // 3KB
   };
   ```
2. Existing `VALIDATION` constraints apply to guides

## Testing Requirements

### Unit Tests

| Test File                            | Coverage                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `scripts/tests/generator.spec.ts`    | `generateSkill()` returns [summary, guide] pair; paths correct; types set |
| `scripts/tests/quality-gate.spec.ts` | Summary scoring criteria; guide scoring without frontmatter               |

**Key test cases for generator**:

- `generateSkill()` returns array of length 2
- First element has `type: 'summary'`, path ends with `.md`
- Second element has `type: 'guide'`, path ends with `.guide.md`
- Both share the same `sourceHash`
- Summary contains guide pointer
- Guide does not contain frontmatter
- Router generation still returns single `GeneratedSkill`

**Key test cases for quality gate**:

- Summary with all sections scores ≥70
- Summary missing guide pointer fails
- Summary over 3KB flagged
- Guide without frontmatter passes (not penalized)
- Guide with frontmatter flagged

## Validation Commands

```bash
# Run all tests
bun test

# Run focused tests
bun test scripts/tests/generator.spec.ts scripts/tests/quality-gate.spec.ts

# Generate without refinement (verify dual-file output)
bun run generate

# Verify file counts
ls skills/workos/*.guide.md | wc -l  # Should be 33

# Verify summary sizes
wc -c skills/workos/workos-sso.md  # Should be <3KB

# Verify guide sizes
wc -c skills/workos/workos-sso.guide.md  # Should be >1KB

# Format check
bun run format:check

# Full refinement
bun run generate -- --refine --force
```

---

_This spec is ready for implementation._
