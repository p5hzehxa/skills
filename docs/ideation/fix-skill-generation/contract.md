# Fix Skill Generation Contract

**Created**: 2026-02-24
**Confidence Score**: 95/100
**Status**: Draft

## Problem Statement

The eval harness (12 cases, 5 products) proved that generated skills barely help Claude produce correct code (+5% avg delta) while hand-crafted skills meaningfully improve output (+17% avg delta). Worse, the SSO skill actively degrades Claude's performance (-5% delta) — Claude produces better SSO code *without* the skill loaded.

Root causes from the eval data:
- Generated guides are 7-11KB of generic content that adds noise to Claude's context
- The SSO guide caused Claude to use the wrong API namespace (`userManagement` vs `sso`) because the guide's broad context blurred related APIs
- The refiner prompt produces feature-level decision trees ("SP vs IdP initiated") instead of implementation-level trees ("which parameter to pass")
- Verification commands are unrunnable prose ("Confirm env vars are set") instead of bash one-liners
- The eval scorer has false positives: anti-pattern "reject requests without state" matches text saying "don't reject requests without state"

## Goals

1. **Raise generated skill avg delta from +5% to ≥+15%** by making guides leaner, more concrete, and recipe-shaped
2. **Eliminate negative deltas** — no skill should make Claude worse. SSO must move from -5% to ≥0%
3. **Fix scorer false positives** — anti-pattern matching must be negation-aware
4. **Shrink generated guides from 7-11KB to 3-5KB** — match the size range where hand-crafted skills succeed
5. **Quality gate must still pass** — all 64 skills score ≥70 after changes

## Success Criteria

- [ ] `bun test` passes (existing + new scorer tests)
- [ ] `bun run eval` shows SSO delta ≥ 0% (was -5%)
- [ ] `bun run eval` shows generated avg delta ≥ +10% (was +5%)
- [ ] Regenerated SSO guide is ≤5KB (was ~7.5KB)
- [ ] Quality gate: `bun run generate -- --refine --force` passes ≥60/64 skills
- [ ] Anti-pattern scorer test: "don't reject without state" does NOT trigger false positive

## Scope Boundaries

### In Scope

- Eval scorer: negation-aware anti-pattern matching (`scripts/eval/scorer.ts`)
- Refiner prompt: 150-line cap, implementation-level trees, concrete bash verification (`scripts/lib/refiner.ts`)
- Template scaffold: cap subsection extraction, skip non-actionable sections (`scripts/lib/skill-template.ts`)
- Quality gate: reverse size scoring (reward small), bash verification bonus (`scripts/lib/quality-gate.ts`)
- Refiner MAX_TOKENS: reduce to 4096 for feature guides (`scripts/lib/refiner.ts`)
- Unit tests for new scorer behavior (`scripts/tests/eval-scorer.spec.ts`)

### Out of Scope

- Hand-crafted AuthKit skills — already effective, don't touch
- Summaries — already lean (~1KB), working fine
- API ref stubs — deterministic, no refinement needed
- YAML test cases — keep current 12 for regression comparison
- Router SKILL.md — separate concern
- Adding new skills or products — content fix first

### Future Considerations

- Expand hand-crafted recipe-style skills to DSync, RBAC (if generated delta stays low after fixes)
- Add LLM-based grader to eval harness for nuanced scoring
- Per-language test cases (Python, Ruby) once Node baseline is solid

---

_This contract was generated from eval harness findings. Review and approve before proceeding to specification._
