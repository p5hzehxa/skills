# @workos/skills

Claude Code plugin providing WorkOS integration skills (AuthKit, SSO, Directory Sync, RBAC, FGA, etc.).

## Commands

```bash
pnpm generate                 # fetch docs, parse, split, generate skills
pnpm generate -- --refine    # + AI refinement pass (requires ANTHROPIC_API_KEY)
pnpm generate -- --refine --force  # force regenerate + refine all
pnpm generate -- --refine-only=workos-sso --force  # refine single skill
pnpm test                     # run tests (vitest)
pnpm format                   # prettier --write
pnpm format:check             # prettier --check
```

## Project Structure

- `.claude-plugin/marketplace.json` — marketplace catalog (source: `./plugins/workos`)
- `plugins/workos/` — installable plugin (only this gets cached)
  - `.claude-plugin/plugin.json` — plugin manifest
  - `skills/` — skill directories, each with `SKILL.md`
    - **Hand-crafted** (never overwrite): `workos-authkit-base`, `workos-authkit-nextjs`, `workos-authkit-react`, `workos-authkit-react-router`, `workos-authkit-tanstack-start`, `workos-authkit-vanilla-js`
    - **Generated** — everything in `workos/references/`; produced by `scripts/generate.ts`
      - **Summary** (`workos-sso.md`) — routing doc, <1KB
      - **Guide** (`workos-sso.guide.md`) — implementation, 7-11KB, no frontmatter
      - **API ref stub** (`workos-api-sso.guide.md`) — deterministic endpoint table, ~1KB
      - **Feedback** (`workos-sso.feedback.md`) — domain expert corrections for refiner
- `scripts/` — generation pipeline (not cached with plugin)
  - `generate.ts` — orchestrator: fetch → parse → split → generate → refine → quality gate → write
  - `lib/` — pipeline modules: `fetcher`, `parser`, `validator`, `splitter`, `api-ref-splitter`, `generator`, `skill-template`, `refiner`, `quality-gate`, `feedback`, `hasher`, `config`, `types`
  - `tests/` — `*.spec.ts` files using vitest

## Key Conventions

- **Never overwrite hand-crafted skills.** Listed in `scripts/lib/config.ts` (`HAND_CRAFTED_SKILLS`). The generator skips them.
- Generated skills use progressive disclosure: summary (routing) + guide (implementation). Agent loads summary first, reads guide only when implementing.
- Summaries have YAML frontmatter (`name`, `description`). Guides and stubs do not.
- API ref guides (`workos-api-*`) are deterministic stubs — no LLM refinement.
- Feedback files (`*.feedback.md`) with `## Corrections` and `## Emphasis` are injected into refiner prompts.
- Section split strategies: `scripts/lib/config.ts` (`SECTION_CONFIG`).
- Size constraints: summaries 200B–2KB, guides 500B–50KB.

## Runtime

- **Node** (>=18) via **tsx** — TypeScript execution without build step
- **vitest** — test runner
- **TypeScript** — strict mode, ESNext target, bundler module resolution
- No build step; scripts run directly via `npx tsx`

## Eval Framework

Measures whether skills improve agent-generated WorkOS implementations.

### Eval Commands

```bash
bun run scripts/eval.ts --dry-run                        # verify cases load
bun run scripts/eval.ts --no-cache --product=sso         # run specific product
bun run scripts/eval.ts --no-cache --lang=python         # run specific language
bun run scripts/eval.ts --no-cache --case=sso-node-basic # run single case
bun run scripts/eval.ts --no-cache --fail-on-regression  # full run with gates
bash scripts/eval-ci.sh                                  # CI wrapper
bash scripts/eval-ci.sh --dry-run                        # CI dry run (no API key needed)
```

### Interpreting Results

- **Delta** = with-skill composite minus without-skill composite
- **Positive delta** = skill helps. Target: ≥ +8 for generated, ≥ +15 for hand-crafted
- **Zero delta** = skill adds no value for this scenario (LLM already knows)
- **Negative delta** = skill hurts — investigate for wrong information in skill
- GREEN (≥ +20%): strong skill value
- YELLOW (≥ +10%): moderate skill value
- RED (< +10%): low skill value

**Hard gates** (`--fail-on-regression`): no product with negative avg delta, hallucination reduction ≥ 50%.

### Troubleshooting

- **Rate limits**: `--concurrency=1`
- **Stale cache**: `--no-cache`
- **Single case debugging**: `--case=<id>`
- **Token costs**: ~$0.15-0.25 per full 40-case run at temperature 0
