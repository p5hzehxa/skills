# Contract: Progressive Disclosure for Generated Skills

## Problem

Generated skills are 8-16KB each. When the router dispatches to a skill, the entire file loads into agent context — even when the agent only needs to understand _what_ a feature is (exploration) rather than _how_ to implement it. Agents exploring 2-3 features before choosing one load 24-48KB of procedural content they don't need yet.

## Goals

Split each of the 33 generated skills into two files:

- **Summary** (1-2KB): what the feature is, when to use it, key concepts, pointer to the full guide
- **Guide** (8-16KB): step-by-step implementation, verification, error recovery

Agents load summaries during exploration and guides only when implementing. Estimated context savings: 60-80% for exploratory workflows.

## Success Criteria

- All 33 generated skills produce both a summary `.md` and a guide `.guide.md`
- Summary files are 500B–3KB; guide files are 500B–50KB
- Router dispatches to summaries (no router changes needed — file names unchanged)
- Summaries contain: frontmatter, when to use, key concepts, doc URLs, guide pointer, related skills
- Guides contain: fetch docs step, prerequisites, implementation steps, verification, error recovery
- Refiner produces both summary and guide (summary refined for key concepts extraction)
- Quality gate validates both file types with appropriate criteria
- Content-addressed locking works for both files (shared source hash)
- Hand-crafted AuthKit skills are unchanged
- All existing tests pass; new tests cover dual-file generation
- `bun run generate` and `bun run generate -- --refine --force` both work

## Scope

### In scope

- `skill-template.ts` — new `renderSummary()`, rename `renderSkill()` → `renderGuide()`
- `generator.ts` — return summary + guide pair from `generateSkill()`
- `refiner.ts` — refine both summaries (for key concepts) and guides (for implementation)
- `quality-gate.ts` — separate scoring criteria for summary vs guide
- `generate.ts` — handle dual-file output, parallel refinement of both types
- `types.ts` — add `type` field to `GeneratedSkill`
- `config.ts` — add summary size constraints
- Quality gate tests and generator tests updated

### Out of scope

- Router changes (router already dispatches to `{name}.md` which stays as the summary)
- Hand-crafted AuthKit skill changes
- Plugin manifest changes (generated skills aren't in manifests)
- Re-refinement of all 33 skills (separate run after code changes)

## Non-Goals

- Changing the router dispatch mechanism
- Adding a build step or compilation phase (Vercel-style AGENTS.md aggregation)
- Restructuring into subdirectories per skill
