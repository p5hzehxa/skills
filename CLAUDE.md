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
