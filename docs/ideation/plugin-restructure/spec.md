# Spec: Plugin Directory Restructure

## Overview

Move skill files from `skills/` at repo root into `plugins/workos/skills/`, creating a clean separation between marketplace root and plugin root. Update all pipeline paths. Delete obsolete scripts.

## Target Structure

```
repo-root/                                  ← marketplace root
  .claude-plugin/
    marketplace.json                        ← source: "./plugins/workos"
  plugins/
    workos/                                 ← plugin root (cached on install)
      .claude-plugin/
        plugin.json
      skills/
        workos/
          SKILL.md
          references/
            *.md, *.guide.md, *.feedback.md
        workos-authkit-base/SKILL.md
        workos-authkit-nextjs/SKILL.md
        workos-authkit-react/SKILL.md
        workos-authkit-react-router/SKILL.md
        workos-authkit-tanstack-start/SKILL.md
        workos-authkit-vanilla-js/SKILL.md
  scripts/                                  ← stays (not cached)
  docs/
  package.json
```

## Step 1: Move files

### 1.1 Create new directory structure

```bash
mkdir -p plugins/workos/.claude-plugin
mkdir -p plugins/workos/skills
```

### 1.2 Move plugin manifest

```bash
mv .claude-plugin/plugin.json plugins/workos/.claude-plugin/plugin.json
```

### 1.3 Move all skill directories

```bash
mv skills/workos plugins/workos/skills/workos
mv skills/workos-authkit-base plugins/workos/skills/workos-authkit-base
mv skills/workos-authkit-nextjs plugins/workos/skills/workos-authkit-nextjs
mv skills/workos-authkit-react plugins/workos/skills/workos-authkit-react
mv skills/workos-authkit-react-router plugins/workos/skills/workos-authkit-react-router
mv skills/workos-authkit-tanstack-start plugins/workos/skills/workos-authkit-tanstack-start
mv skills/workos-authkit-vanilla-js plugins/workos/skills/workos-authkit-vanilla-js
```

### 1.4 Remove old skills/ directory

```bash
rmdir skills/  # should be empty after moves
```

### 1.5 Delete obsolete scripts

```bash
rm scripts/build-plugin-manifests.ts
rm scripts/sync-marketplace.ts
```

## Step 2: Update marketplace.json

File: `.claude-plugin/marketplace.json`

Change `source` from `"./"` to `"./plugins/workos"`:

```json
{
  "name": "workos",
  "owner": {
    "name": "WorkOS",
    "email": "support@workos.com"
  },
  "metadata": {
    "description": "Official WorkOS skills for AI coding agents",
    "version": "1.0.0"
  },
  "plugins": [
    {
      "name": "workos",
      "source": "./plugins/workos",
      "description": "WorkOS integration skills for AuthKit, SSO, Directory Sync, RBAC, Vault, Audit Logs, migrations, and API references."
    }
  ]
}
```

## Step 3: Update generation pipeline paths

All path changes follow the same pattern: `skills/` → `plugins/workos/skills/`

### 3.1 scripts/lib/generator.ts (4 references)

| Line | Old                                                    | New                                                                   |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------- |
| ~27  | `` `skills/workos/references/${spec.name}.md` ``       | `` `plugins/workos/skills/workos/references/${spec.name}.md` ``       |
| ~37  | `` `skills/workos/references/${spec.name}.guide.md` `` | `` `plugins/workos/skills/workos/references/${spec.name}.guide.md` `` |
| ~204 | `"skills/workos/SKILL.md"`                             | `"plugins/workos/skills/workos/SKILL.md"`                             |
| ~435 | `"skills/workos/references/workos-integrations.md"`    | `"plugins/workos/skills/workos/references/workos-integrations.md"`    |

### 3.2 scripts/lib/feedback.ts (1 reference)

Change path join from:

```typescript
join(
  process.cwd(),
  "skills",
  "workos",
  "references",
  `${skillName}.feedback.md`,
);
```

To:

```typescript
join(
  process.cwd(),
  "plugins",
  "workos",
  "skills",
  "workos",
  "references",
  `${skillName}.feedback.md`,
);
```

### 3.3 scripts/lib/types.ts (1 comment)

Update comment example path:

```typescript
/** Relative write path, e.g. "plugins/workos/skills/workos/references/workos-sso.md" */
```

### 3.4 scripts/generate.ts (1 reference)

Update gold standard path:

```
"skills/workos-authkit-nextjs/SKILL.md" → "plugins/workos/skills/workos-authkit-nextjs/SKILL.md"
```

### 3.5 scripts/refine-batch.ts (2 references)

| Old                                       | New                                                      |
| ----------------------------------------- | -------------------------------------------------------- |
| `` `skills/${name}/SKILL.md` ``           | `` `plugins/workos/skills/${name}/SKILL.md` ``           |
| `"skills/workos-authkit-nextjs/SKILL.md"` | `"plugins/workos/skills/workos-authkit-nextjs/SKILL.md"` |

### 3.6 scripts/lib/refiner.ts (1 reference)

Change skills directory lookup:

```typescript
// Old:
const skillsDir = join(process.cwd(), "skills");
// New:
const skillsDir = join(process.cwd(), "plugins", "workos", "skills");
```

### 3.7 scripts/lib/skill-template.ts

**No changes needed.** The guide pointer (`references/${skillName}.guide.md`) is relative to the skill directory — it survives the move.

### 3.8 scripts/lib/quality-gate.ts

**No changes needed.** Uses `skill.path` (which is set by generator.ts, already updated in 3.1) and regex patterns that match relative `references/` paths.

## Step 4: Update test files

### 4.1 scripts/tests/generator.spec.ts (4 assertions)

| Old                                                 | New                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| `"skills/workos/references/workos-sso.md"`          | `"plugins/workos/skills/workos/references/workos-sso.md"`          |
| `"skills/workos/references/workos-sso.guide.md"`    | `"plugins/workos/skills/workos/references/workos-sso.guide.md"`    |
| `"skills/workos/SKILL.md"`                          | `"plugins/workos/skills/workos/SKILL.md"`                          |
| `"skills/workos/references/workos-integrations.md"` | `"plugins/workos/skills/workos/references/workos-integrations.md"` |

### 4.2 scripts/tests/quality-gate.spec.ts (2 defaults)

| Old                                                     | New                                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `"skills/workos/references/workos-test-skill.guide.md"` | `"plugins/workos/skills/workos/references/workos-test-skill.guide.md"` |
| `"skills/workos/references/workos-test-skill.md"`       | `"plugins/workos/skills/workos/references/workos-test-skill.md"`       |

### 4.3 scripts/tests/paths.spec.ts (2 constants + 1 regex)

```typescript
// Old:
const PLUGIN_DIR = join(import.meta.dir, "../../skills/workos");
// New:
const PLUGIN_DIR = join(import.meta.dir, "../../plugins/workos/skills/workos");
```

REFS_DIR derives from PLUGIN_DIR — no additional change needed.

Regex pattern (line ~59): Already matches relative `references/` paths — **no change needed**.

## Step 5: Update project files

### 5.1 package.json

Change `"files"` array:

```json
"files": ["plugins"]
```

### 5.2 CLAUDE.md

Update the Project Structure section to reflect `plugins/workos/skills/` paths instead of `skills/`.

## Verification

Run in order:

```bash
# 1. Tests pass
bun test

# 2. Generator writes to correct paths
bun run scripts/generate.ts --force
ls plugins/workos/skills/workos/references/  # should have generated files

# 3. No files at old location
ls skills/ 2>&1  # should error: No such file or directory

# 4. Plugin validates
claude plugin validate .

# 5. Marketplace + install (manual test)
# /plugin marketplace add /Users/nicknisi/Developer/skills
# /plugin install workos@workos
# /workos  ← should activate
```
