# Skill Quality V2 Contract

**Created**: 2026-02-19
**Confidence Score**: 97/100
**Status**: Approved

## Problem Statement

V1 shipped 63/64 generated skills passing quality gate with progressive disclosure (summary + guide split). Spot-check reviews by the skill-reviewer agent identified 4 gaps between generated and hand-crafted skills:

1. Generated guides have zero code — they say "Check fetched docs for SDK methods" while hand-crafted AuthKit skills have copy-paste snippets
2. 11 API reference guides (~82KB total) mostly restate what's already in the official docs
3. Summaries at 975B-1.9KB carry dead weight (Documentation URLs already in guides, oversized Key Vocabulary)
4. No tests verify that guide pointers, router references, and Related Skills cross-refs resolve to real files

These gaps reduce the practical value of generated skills and waste agent context on redundant content.

## Goals

1. Every feature guide contains one language-agnostic SDK code example (10-25 lines) showing the primary integration pattern
2. API reference guides reduced from 5-10KB to <2KB deterministic stubs (endpoint table + doc pointer + feature guide link)
3. Summaries trimmed to <1KB (target 400-600B after frontmatter) by removing Documentation section and capping Key Vocabulary at 5 bullets
4. Integration tests validate all cross-file path references resolve to existing files

## Success Criteria

- [ ] Feature guides contain ≥1 code block ≥5 lines
- [ ] API ref guides (`workos-api-*.guide.md`) are <2KB with endpoint table + feature guide pointer
- [ ] Generated summaries are <1KB
- [ ] `bun test` passes (including new `scripts/tests/paths.spec.ts`)
- [ ] Quality gate: 64/64 passing after `--refine --force`
- [ ] No orphaned guides, broken guide pointers, or dead Related Skills references

## Scope Boundaries

### In Scope

- Refiner prompt changes for code examples and leaner summaries
- New `renderApiRefStub()` template function
- Generator routing for API ref stubs
- Quality gate scoring updates (code bonus, stub scorer, summary rebalance)
- Config validation constant updates
- New path resolution integration tests
- Test updates for all scoring changes

### Out of Scope

- Hand-crafted AuthKit skills — untouched
- Router and integration router — unchanged
- Feedback files — unchanged
- Fetcher, parser, splitter pipeline stages — unchanged
- New features or skills — this is quality-only

### Future Considerations

- Per-skill code example validation (verify SDK method names are real)
- Cross-file contradiction detection (summary vs guide claims)
- Automated spot-check CI step using skill-reviewer agent
