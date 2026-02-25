# Skill Quality Framework Contract

**Created**: 2026-02-19
**Confidence Score**: 94/100
**Status**: Draft

## Problem Statement

WorkOS skills bake in factual claims about API behavior that go stale when docs change. The Directory Sync skill claimed "webhooks are mandatory, polling is not supported" — factually wrong (WorkOS supports both). A domain expert flagged it. The regex-based rules system (.rules.yml) added to catch such errors instead _enforced_ the wrong claim, because regex patterns can't reliably gate semantic correctness.

The root issue: skills try to be documentation instead of guides to documentation. When a skill reproduces schemas, code examples, and behavioral assertions from docs, it creates a stale copy that diverges silently. Current generated skills are 30-58% baked-in facts from docs, with API reference skills being the worst offenders.

This blocks shipping: we can't confidently ship 33 generated skills knowing any of them might contain incorrect factual claims with no reliable way to catch or correct them.

## Goals

1. **Shift skill content philosophy** — refiner prompts produce skills that are procedural scaffolding (decision trees, verification, error recovery, guardrails) with structural vocabulary, not behavioral assertions. Target: <15% baked behavioral claims per skill.
2. **Replace regex rules with natural language feedback** — domain experts write `.feedback.md` files with corrections in plain English. Feedback is injected into the refiner prompt and validated by an LLM-based semantic check during `--refine` runs.
3. **Evolve the quality gate** — deterministic checks for structure/formatting on all runs. LLM-based semantic check (verifying feedback corrections are respected and behavioral claims are deferred to docs) on `--refine` runs only.
4. **Establish a content taxonomy** — codify what IS and ISN'T acceptable in skills, enforced by the quality gate:
   - **Safe to bake in**: Structural vocabulary (concept names, ID prefixes, env vars, event type naming conventions), architectural decisions (upsert patterns, async webhook handling, signature verification patterns), decision trees, trap warnings.
   - **Defer to docs**: Behavioral claims ("X is required", "Y is not supported"), exact SDK method signatures, complete code examples, request/response schemas, error code tables, rate limits.

## Success Criteria

- [ ] Refiner prompts produce skills matching the content taxonomy (structural facts + procedural guidance, no behavioral assertions)
- [ ] `.feedback.md` files exist as a mechanism: per-skill markdown with natural language corrections
- [ ] Feedback content is injected into refiner prompts during refinement
- [ ] LLM-based semantic check runs during `--refine` and validates: (a) feedback corrections are respected, (b) behavioral claims defer to docs
- [ ] Quality gate deterministic checks still run on all generates (structure, formatting, size)
- [ ] Existing regex `.rules.yml` system is replaced by `.feedback.md` (migration path)
- [ ] All 33 generated skills can be re-refined through the new pipeline without regression
- [ ] `bun test` passes with updated test coverage for new components

## Scope Boundaries

### In Scope

- New refiner prompts encoding the content taxonomy and procedural-first philosophy
- `.feedback.md` feedback mechanism (file format, loading, injection into refiner)
- LLM-based semantic quality check (runs only with `--refine`)
- Updated deterministic quality gate criteria
- Migration of existing `.rules.yml` content to `.feedback.md` format
- Updated tests for new/changed components
- Updated refiner attribution block

### Out of Scope

- Generator templates and skill-template.ts — refiner handles the content transformation
- Splitter, parser, fetcher — unchanged
- Hand-crafted AuthKit skills (6) — untouched
- New dsync gold standard — follow-up project after this framework is proven
- Router skill changes — already 100% procedural
- Config changes (SECTION_CONFIG, HAND_CRAFTED_SKILLS, VALIDATION thresholds)

### Future Considerations

- Rewrite dsync as the new gold standard for generated skills (replaces authkit-nextjs in refiner)
- Retry loop: quality gate feeds violations back to refiner for a second pass
- Feedback sourced from GitHub Issues (tagged by skill) instead of local files
- Per-skill "staleness score" based on time since last doc fetch vs last refinement

---

_This contract was generated from brain dump input. Review and approve before proceeding to specification._
