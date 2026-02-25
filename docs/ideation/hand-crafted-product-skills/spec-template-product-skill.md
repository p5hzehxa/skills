# Product Skill Template

**Contract**: ./contract.md

## Structure (150-200 lines, 3-5KB)

Every hand-crafted product skill follows this exact structure. Copy the skeleton, fill in product-specific content.

**Pattern to follow**: `plugins/workos/skills/workos-authkit-nextjs/SKILL.md`

### Skeleton

````markdown
<!-- hand-crafted -->

# WorkOS {Product Name} — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- {doc URL 1}
- {doc URL 2}
- {doc URL 3}

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

{env vars with bash verification}

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing"
{product-specific env var checks}
```
````

## Step 3: {Primary Decision Tree}

{Implementation-level decision tree — each leaf is a CODE DECISION}

```
{question}?
  |
  +-- {option A}
  |     → {which param/method to use}
  |
  +-- {option B}
        → {which param/method to use}
```

**Trap:** {thing Claude gets wrong without this guidance}

## Step 4: {Primary Integration Pattern}

{ONE code example, 10-25 lines, language-agnostic SDK syntax}

```
{workos.{domain}.{method}({
  {key params with comments explaining each}
})}
```

## Step 5: {Secondary Pattern or Trap Warning}

{Second most important thing — usually an alternative flow or critical gotcha}

## Verification Checklist (ALL MUST PASS)

```bash
# 1. {what it checks}
grep -r "{pattern}" src/ || echo "FAIL: {what's missing}"

# 2. {what it checks}
{bash one-liner with pass/fail output}

# 3. {what it checks}
{bash one-liner with pass/fail output}
```

## Error Recovery

### "{exact error message 1}"

**Cause:** {root cause}
**Fix:**

1. {specific fix step}
2. {specific fix step}

### "{exact error message 2}"

**Cause:** {root cause}
**Fix:**

1. {specific fix step}
2. {specific fix step}

### "{exact error message 3}"

**Cause:** {root cause}
**Fix:**

1. {specific fix step}
2. {specific fix step}

````

## Key Principles (from eval data)

1. **Decision trees end at code** — every leaf maps to a param, method, or file to create. Not "choose between approach A and B" — "use `domainHint` param vs `organization` param."

2. **Bash verification is runnable** — `grep -r "pattern" src/ || echo "FAIL"`. Not "confirm X is set up."

3. **Error recovery uses exact strings** — `"Invalid state"`, `"signin_consent_denied"`, `"Invalid signature"`. Not "authentication error."

4. **ONE code example** — the primary happy-path integration. Language-agnostic: `workos.{domain}.{method}()`. No TypeScript/Python/Ruby syntax.

5. **Trap warnings from eval failures** — what did Claude get wrong in the eval? That's the trap to warn about.

## Writing Process

1. Read the corresponding generated guide to understand what content exists
2. Read the eval test cases (`scripts/eval/cases/{product}.yaml`) to know what signals the eval checks
3. Read WorkOS docs for the product to verify method names, params, error messages
4. Write the skill following the skeleton above
5. Run quality gate: check skill scores ≥70
6. Run eval with `--no-cache` to measure delta improvement

## File Placement

Hand-crafted guides replace generated guides in-place:
- Write to: `plugins/workos/skills/workos/references/workos-{product}.guide.md`
- The summary `.md` file is NOT replaced — it stays generated
- Add a protection entry to prevent regeneration (see per-product spec for details)

## Config Change (shared across all 3)

In `scripts/lib/config.ts`, the `HAND_CRAFTED_SKILLS` list protects skills from regeneration. Currently it only lists top-level skill directory names. For reference-file protection, add a new constant:

```typescript
/** Hand-crafted guide files that must never be overwritten by generation */
export const HAND_CRAFTED_GUIDES = [
  "workos-sso",
  "workos-directory-sync",
  "workos-rbac",
] as const;
````

Then in `scripts/generate.ts`, check this list before writing guide files. The generator already skips `HAND_CRAFTED_SKILLS` — extend the same logic to guide files.
