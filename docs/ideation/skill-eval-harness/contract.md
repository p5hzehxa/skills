# Skill Eval Harness Contract

**Created**: 2026-02-24
**Confidence Score**: 95/100
**Status**: Draft

## Problem Statement

The @workos/skills plugin ships 39 skills (6 hand-crafted, 33 generated) totaling 432KB, but there's no measurement of whether these skills actually improve Claude's code output. Architecture decisions (product-focused restructuring, per-language SDK references, content changes) are being debated without baseline data on what Claude gets right or wrong with and without skills loaded.

The quality gate scores structural correctness (formatting, sections, size) but not practical effectiveness. A skill can score 95/100 structurally while producing no measurable improvement in Claude's generated code.

## Goals

1. **Measure skill effectiveness** via A/B testing — identical prompts run with and without skill content, scored against expected signals (methods, env vars, imports, flow steps)
2. **Identify failure categories** — classify what Claude gets wrong (hallucinated methods, wrong params, missing env vars, incorrect flow ordering) to target improvements
3. **Compare generated vs hand-crafted skill quality** — quantify the effectiveness gap to inform where hand-curation is worth the investment
4. **Establish a +20% delta bar** — skills that don't improve composite score by at least 20 percentage points need rework or aren't adding value
5. **Make the eval runnable and cheap** — `bun run eval` with content-addressed caching, ~$0.50/full run, filterable by product

## Success Criteria

- [ ] `bun run eval -- --dry-run` lists all test cases without API calls
- [ ] `bun run eval -- --case=sso-node-basic` runs a single case and prints scores
- [ ] `bun run eval` runs all cases and outputs both a console table and JSON report
- [ ] Scorer unit tests pass (`bun test` covers `scripts/tests/eval-scorer.spec.ts`)
- [ ] Cache prevents redundant API calls (same inputs → cached response)
- [ ] Report shows per-product: with-skill score, without-skill score, delta, top error categories
- [ ] Report distinguishes generated vs hand-crafted skill effectiveness
- [ ] Initial test cases cover top 5 products (SSO, AuthKit/Next.js, Directory Sync, Audit Logs, RBAC)
- [ ] Node.js language focus (test prompts target Node SDK usage)

## Scope Boundaries

### In Scope

- Eval types (`EvalCase`, `ScoreCard`, `EvalResult`, `EvalReport`)
- Anthropic API wrapper (reusing `refiner.ts` fetch pattern)
- Content-addressed response cache (SHA-256 keyed)
- Deterministic scorer (method accuracy, param accuracy, env var coverage, flow correctness, anti-pattern avoidance, hallucination penalty)
- Error categorization (hallucinated methods, wrong params, missing env vars, wrong flow, incorrect config)
- Console table reporter + JSON file output
- Runner orchestrator (load YAML cases → load skills → call API → score → report)
- CLI entrypoint with `--product`, `--case`, `--dry-run`, `--no-cache`, `--model` flags
- ~12-15 test cases across SSO, AuthKit/Next.js, Directory Sync, Audit Logs, RBAC
- `package.json` script: `"eval": "bun run scripts/eval.ts"`

### Out of Scope

- LLM-based grading pass — deterministic scoring first, LLM grading can be added later
- Multi-language testing — Node.js only for v1; Python/Ruby/Go deferred
- Framework-specific evals beyond AuthKit/Next.js — other AuthKit frameworks deferred
- CI integration — manual `bun run eval` for now
- Test cases for migration skills — lower priority
- Automated threshold enforcement — report-only, no pipeline blocking

### Future Considerations

- LLM grader (`--grade` flag) for nuanced semantic scoring
- Python + Ruby language coverage to test cross-language skill effectiveness
- Third arm: "with raw docs" (no skill, just doc URLs) to isolate skill value vs. any-context value
- CI nightly eval runs with regression detection
- Test cases for all 12 products + migration skills
- Correlation analysis: quality gate scores vs eval deltas

---

_This contract was generated from brain dump input and deliberation findings. Review and approve before proceeding to specification._
