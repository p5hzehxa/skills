# Hand-Crafted Product Skills Contract

**Created**: 2026-02-24
**Confidence Score**: 97/100
**Status**: Draft

## Problem Statement

The eval harness consistently shows hand-crafted skills outperform generated ones: +16% avg delta vs +5%. Three products — SSO, Directory Sync, and RBAC — have the biggest gaps between "with skill" and "without skill" scores, and their generated guides don't close those gaps effectively.

The generated guides fail because they're reference-shaped (generic decision trees, prose verification, broad coverage). The AuthKit/Next.js skill succeeds because it's recipe-shaped (implementation-level decisions, bash verification, trap warnings for specific mistakes, concrete code). These 3 products need the same treatment.

## Goals

1. **Write 3 hand-crafted product recipe skills** — SSO, Directory Sync, RBAC — matching AuthKit/Next.js quality patterns
2. **Target 3-5KB per skill** (150-200 lines) — same size range where hand-crafted skills succeed
3. **Framework-agnostic but concrete** — decision trees end at code decisions (which SDK param/method), not feature descriptions
4. **Improve eval delta** — each product should improve from current generated delta toward +10-15%
5. **Replace generated guides** — hand-crafted files replace the `.guide.md` in `references/`, summaries stay

## Success Criteria

- [ ] SSO hand-crafted guide is 3-5KB with implementation-level decision trees
- [ ] DSync hand-crafted guide is 3-5KB with webhook trap warnings and event type map
- [ ] RBAC hand-crafted guide is 3-5KB with permission vs role check decision tree
- [ ] Each guide has ≥3 bash verification commands (grep/echo, not prose)
- [ ] Each guide has ONE code example (10-25 lines, language-agnostic SDK syntax)
- [ ] Each guide has ≥3 error recovery sections with exact error → fix mapping
- [ ] Quality gate passes for all 3 skills (≥70/100)
- [ ] `bun run eval -- --no-cache` shows no negative deltas for SSO, DSync, RBAC
- [ ] Eval test case YAML files updated: `skillType: generated` → `hand-crafted` is NOT needed (these are still references/ files loaded by the runner as generated-style concatenation)

## Scope Boundaries

### In Scope

- `plugins/workos/skills/workos/references/workos-sso.guide.md` — replace with hand-crafted
- `plugins/workos/skills/workos/references/workos-directory-sync.guide.md` — replace with hand-crafted
- `plugins/workos/skills/workos/references/workos-rbac.guide.md` — replace with hand-crafted
- Add SSO, DSync, RBAC to `HAND_CRAFTED_SKILLS` in `scripts/lib/config.ts` (prevents regeneration overwriting them)
- Update `HAND_CRAFTED_SKILLS` to include the guide file names (not just skill directory names)

### Out of Scope

- Summaries (.md files) — keep generated, they work fine as routing docs
- API ref stubs — keep generated, deterministic and adequate
- Other products (Vault, MFA, Events, etc.) — evaluate after these 3 ship
- Eval test case changes — current cases test the right signals regardless of skill authorship
- Router SKILL.md — separate concern, already regenerated

### Future Considerations

- If these 3 succeed, apply same pattern to Audit Logs, Events, MFA
- Consider a "recipe template" to standardize hand-crafted skill structure
- Long-term: can the refiner be trained to produce recipe-quality output automatically?

---

_This contract was generated from eval harness findings. Review and approve before proceeding to specification._
