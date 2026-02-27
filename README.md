# @workos/skills

WorkOS skills for AI coding agents. 39 skills covering AuthKit, SSO, Directory Sync, RBAC, Vault, Migrations, API references, and more.

## Install

```bash
npx skills add workos/skills
```

Works with Claude Code, Cursor, Codex, Goose, and any agent that supports the skills.sh format.

## Skills

### AuthKit

| Skill                           | Description                     |
| ------------------------------- | ------------------------------- |
| `workos-authkit-nextjs`         | Next.js App Router integration  |
| `workos-authkit-react`          | React SPA integration           |
| `workos-authkit-react-router`   | React Router v6/v7 integration  |
| `workos-authkit-tanstack-start` | TanStack Start integration      |
| `workos-authkit-vanilla-js`     | Vanilla JS integration          |
| `workos-authkit-base`           | Framework detection and routing |

### Features

| Skill                   | Description                   |
| ----------------------- | ----------------------------- |
| `workos-sso`            | Single Sign-On with SAML/OIDC |
| `workos-directory-sync` | User directory sync from IdPs |
| `workos-rbac`           | Role-based access control     |
| `workos-vault`          | Encrypted data storage        |
| `workos-events`         | Webhook event handling        |
| `workos-audit-logs`     | Compliance audit logging      |
| `workos-admin-portal`   | Self-service admin portal     |
| `workos-mfa`            | Multi-factor authentication   |
| `workos-custom-domains` | Custom domain configuration   |
| `workos-email`          | Email delivery configuration  |
| `workos-widgets`        | Embeddable UI components      |

### Routers

| Skill                 | Description                                           |
| --------------------- | ----------------------------------------------------- |
| `workos`              | Identify which skill to load based on the user's task |
| `workos-integrations` | Provider lookup table for 60+ IdP integrations        |

### Migrations

| Skill                                   | Description                       |
| --------------------------------------- | --------------------------------- |
| `workos-migrate-auth0`                  | Migrate from Auth0                |
| `workos-migrate-firebase`               | Migrate from Firebase Auth        |
| `workos-migrate-clerk`                  | Migrate from Clerk                |
| `workos-migrate-aws-cognito`            | Migrate from AWS Cognito          |
| `workos-migrate-stytch`                 | Migrate from Stytch               |
| `workos-migrate-supabase-auth`          | Migrate from Supabase Auth        |
| `workos-migrate-descope`                | Migrate from Descope              |
| `workos-migrate-better-auth`            | Migrate from Better Auth          |
| `workos-migrate-other-services`         | Migrate from custom auth          |
| `workos-migrate-the-standalone-sso-api` | Upgrade standalone SSO to AuthKit |

### API References

| Skill                       | Description                           |
| --------------------------- | ------------------------------------- |
| `workos-api-sso`            | SSO API endpoints                     |
| `workos-api-authkit`        | AuthKit/User Management API endpoints |
| `workos-api-directory-sync` | Directory Sync API endpoints          |
| `workos-api-audit-logs`     | Audit Logs API endpoints              |
| `workos-api-organization`   | Organizations API endpoints           |
| `workos-api-events`         | Events/Webhooks API endpoints         |
| `workos-api-vault`          | Vault API endpoints                   |
| `workos-api-roles`          | Roles & Permissions API endpoints     |
| `workos-api-widgets`        | Widgets API endpoints                 |
| `workos-api-admin-portal`   | Admin Portal API endpoints            |

## Development

### Generate skills

```bash
# Generate only what's changed (skips skills with matching source hash)
pnpm generate

# Force regenerate all skills from scratch
pnpm generate -- --force

# Generate + AI refinement (requires ANTHROPIC_API_KEY)
pnpm generate -- --refine

# Force regenerate + refine all
pnpm generate -- --refine --force

# Refine a single skill (only writes that skill, safe for iteration)
pnpm generate -- --refine-only=workos-sso --force
```

### Test

```bash
pnpm test
```

### How it works

1. **Fetch** — downloads `llms.txt` (URL index) and `llms-full.txt` (full docs) from workos.com
2. **Parse** — splits docs into sections by `## Name {#anchor}` boundaries
3. **Split** — applies per-section strategies (single, per-subsection, per-api-domain) to produce skill specs
4. **Generate** — transforms specs into summary + guide pairs (or API ref stubs) with source hash markers
5. **Refine** (optional) — calls Anthropic API to transform doc prose into procedural agent instructions. Runs at concurrency 5. API ref stubs skip refinement.
6. **Quality gate** — automated rubric scoring (summaries, guides, stubs, legacy) + LLM semantic check against domain feedback
7. **Write** — skips files with matching source hash (content-addressed locking)

### Progressive disclosure

Each generated skill produces two files:

- **Summary** (`workos-sso.md`) — lightweight routing doc (<1KB). When to Use, Key Vocabulary (entity names + ID prefixes), guide pointer, Related Skills. Agent loads this first.
- **Guide** (`workos-sso.guide.md`) — full implementation (7-11KB). Fetch docs, decision trees, one language-agnostic code example, verification commands, error recovery. Agent reads this only when implementing.

API reference skills use a third format:

- **Stub** (`workos-api-sso.guide.md`) — deterministic endpoint table + doc pointer (~1KB). No LLM refinement needed.

### Content-addressed locking

Each skill has a marker embedding a SHA-256 hash of its source doc content:

```
<!-- generated:sha256:abc123def456 -->   (scaffold)
<!-- refined:sha256:abc123def456 -->     (after refinement)
```

`generate` skips files where the hash matches — only skills whose upstream docs changed get regenerated. Use `--force` to bypass.

### Feedback system

Per-skill `.feedback.md` files encode domain expert corrections:

```markdown
# Feedback for workos-directory-sync

## Corrections

- WorkOS supports both webhooks AND the Events API for directory sync.
  Do not claim webhooks are mandatory or that polling is not supported.

## Emphasis

- The dsync.deleted event does NOT trigger individual user/group delete
  events. This is a common trap — emphasize it.
```

Feedback is loaded by `scripts/lib/feedback.ts` and injected into refiner prompts so the LLM knows constraints upfront. `## Corrections` are hard rules; `## Emphasis` are soft guidance.

### Hand-crafted vs generated

- **Hand-crafted** (6 AuthKit skills) — never overwritten by the generator
- **Generated** (33 skills) — produced by `scripts/generate.ts`, refined via Anthropic API, split into summary + guide pairs
- **Excluded** (5 sections) — skipped during generation: FGA, magic-link, pipes, domain-verification, feature-flags

### Eval framework

The eval framework measures whether skills actually improve agent-generated code. Each eval case runs the same prompt with and without the skill, scores both outputs against expected signals (methods, params, imports, flow steps, hallucinations), and reports the delta.

```bash
# Quick check — verify cases load without API calls
pnpm eval -- --dry-run

# Full run (42 cases, ~$1.70)
pnpm eval -- --no-cache

# Filter by product, language, or single case
pnpm eval -- --no-cache --product=sso
pnpm eval -- --no-cache --lang=python
pnpm eval -- --no-cache --case=sso-node-basic

# Run with regression gates (fails on negative product deltas)
pnpm eval -- --no-cache --fail-on-regression

# Measure variance — run each case N times, report mean ± stddev (~$1.70 × N)
pnpm eval -- --no-cache --samples=2
pnpm eval -- --no-cache --samples=2 --save-all-samples  # persist all sample outputs
```

#### Eval tooling

Review and label eval results without re-running:

```bash
# Side-by-side transcript diff with signal highlighting
pnpm eval:diff -- --case=sso-node-basic

# Add human judgment (ship/no-ship) for scorer calibration
pnpm eval:label -- --case=sso-node-basic --ship=yes --who=nick --reason="correct SSO flow"

# Compare scorer decisions against human labels
pnpm eval:calibrate
```

#### Interpreting results

| Delta                                           | Meaning                                 |
| ----------------------------------------------- | --------------------------------------- |
| Positive (≥ +8% generated, ≥ +15% hand-crafted) | Skill helps                             |
| Zero                                            | Skill adds no value (LLM already knows) |
| Negative                                        | Skill hurts — investigate skill content |

The triage report (printed after each run) surfaces the top 10 riskiest cases automatically — negative deltas, high variance, hallucination regressions.

#### Eval case files

Cases live in `scripts/eval/cases/*.yaml`. Each defines a prompt, expected signals, and known hallucinations. See existing cases for the format.

## License

MIT
