# @workos/skills

Claude Code plugin providing WorkOS integration skills (AuthKit, SSO, Directory Sync, RBAC, FGA, etc.).

## Commands

```bash
bun run generate              # fetch docs, parse, split, generate skills
bun run generate -- --refine  # + AI refinement pass (requires ANTHROPIC_API_KEY)
bun run generate -- --refine --force  # force regenerate + refine all
bun run generate -- --refine-only=workos-sso --force  # refine single skill
bun test                      # run tests (bun test runner)
bun run format                # prettier --write
bun run format:check          # prettier --check
```

## Project Structure

- `skills/` — skill files consumed by Claude Code at runtime
  - **Hand-crafted** (never overwrite): `workos-authkit-base`, `workos-authkit-nextjs`, `workos-authkit-react`, `workos-authkit-react-router`, `workos-authkit-tanstack-start`, `workos-authkit-vanilla-js`
  - **Generated** — everything else; produced by `scripts/generate.ts`
    - **Summary** (`workos-sso.md`) — routing doc with frontmatter, <1KB
    - **Guide** (`workos-sso.guide.md`) — implementation, 7-11KB, no frontmatter
    - **API ref stub** (`workos-api-sso.guide.md`) — deterministic endpoint table, ~1KB
    - **Feedback** (`workos-sso.feedback.md`) — domain expert corrections for refiner
- `scripts/` — generation pipeline
  - `generate.ts` — orchestrator: fetch → parse → split → generate → refine → quality gate → write
  - `lib/` — pipeline modules: `fetcher`, `parser`, `validator`, `splitter`, `api-ref-splitter`, `generator`, `skill-template`, `refiner`, `quality-gate`, `feedback`, `hasher`, `config`, `types`
  - `tests/` — `*.spec.ts` files using `bun:test`

## Key Conventions

- **Never overwrite hand-crafted skills.** Listed in `scripts/lib/config.ts` (`HAND_CRAFTED_SKILLS`). The generator skips them.
- Generated skills use progressive disclosure: summary (routing) + guide (implementation). Agent loads summary first, reads guide only when implementing.
- Summaries have YAML frontmatter (`name`, `description`). Guides and stubs do not.
- API ref guides (`workos-api-*`) are deterministic stubs — no LLM refinement.
- Feedback files (`*.feedback.md`) with `## Corrections` and `## Emphasis` are injected into refiner prompts.
- Section split strategies: `scripts/lib/config.ts` (`SECTION_CONFIG`).
- Size constraints: summaries 200B–2KB, guides 500B–50KB.

## Runtime

- **Bun** — runtime and test runner (not Node)
- **TypeScript** — strict mode, ESNext target, bundler module resolution
- No build step; scripts run directly via `bun run`
