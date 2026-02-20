# Contract: Plugin Directory Restructure

## Problem

The repo uses `source: "./"` in marketplace.json, making the entire repo the plugin. On install, Claude Code caches everything — scripts/, docs/, node_modules/, tests — wasting space and violating the clean marketplace pattern from the Claude Code docs.

## Goals

1. Separate marketplace root from plugin root so only the plugin directory gets cached
2. Update all generation pipeline paths to write to the new location
3. Delete obsolete scripts (build-plugin-manifests.ts, sync-marketplace.ts)
4. All tests pass, plugin installs cleanly, all 7 skills discoverable

## Success Criteria

- `bun test` passes (all existing tests, updated for new paths)
- `/plugin marketplace add ./` registers the marketplace
- `/plugin install workos@workos` installs only `plugins/workos/` to cache
- `/workos`, `/workos-authkit-nextjs`, etc. all appear as skills
- `bun run scripts/generate.ts --force` writes files to `plugins/workos/skills/workos/references/`
- No files exist at old `skills/` location after restructure

## Scope

### In scope

- Move `skills/` → `plugins/workos/skills/`
- Move `.claude-plugin/plugin.json` → `plugins/workos/.claude-plugin/plugin.json`
- Update `marketplace.json` source from `"./"` to `"./plugins/workos"`
- Update all path references in 14 script files
- Update all path assertions in 3 test files
- Delete `scripts/build-plugin-manifests.ts` and `scripts/sync-marketplace.ts`
- Update `package.json` files array
- Update `CLAUDE.md` documentation

### Out of scope

- Content changes to any SKILL.md or reference files (all internal refs are relative — verified safe)
- Logic changes to the generation pipeline
- Changes to the refiner, quality gate scoring, or feedback system logic
- New features or tests beyond path updates
