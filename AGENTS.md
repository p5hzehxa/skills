# WorkOS Skills

A collection of 39 task-based skills that help AI agents implement WorkOS features. Skills encode procedural knowledge — decision trees, verification commands, error recovery — not documentation.

## How to Use

**Start with the router.** Load `skills/workos/SKILL.md` for any WorkOS task. It maps user intent to the right skill.

```
User Request
    │
    ├─ "Add authentication"        → skills/workos-authkit-{framework}/
    ├─ "Configure SSO"             → Read skills/workos/workos-sso.md
    ├─ "Set up Directory Sync"     → Read skills/workos/workos-directory-sync.md
    ├─ "Add RBAC / roles"          → Read skills/workos/workos-rbac.md
    ├─ "Encrypt data with Vault"   → Read skills/workos/workos-vault.md
    ├─ "Handle webhooks / events"  → Read skills/workos/workos-events.md
    ├─ "Set up Audit Logs"         → Read skills/workos/workos-audit-logs.md
    ├─ "Add MFA"                   → Read skills/workos/workos-mfa.md
    ├─ "Set up IdP integration"    → Read skills/workos/workos-integrations.md
    ├─ "Migrate from Auth0/etc"    → Read skills/workos/workos-migrate-{provider}.md
    ├─ "API reference for X"       → Read skills/workos/workos-api-{domain}.md
    └─ "Not sure"                  → WebFetch https://workos.com/docs/llms.txt
```

## Progressive Disclosure

Skills use a two-step loading pattern to save context:

1. **Summary** (`workos-sso.md`, <1KB) — routing doc. Answers: "Is this the right skill?" Contains: When to Use, Key Vocabulary (entity names + ID prefixes), guide pointer, Related Skills.
2. **Guide** (`workos-sso.guide.md`, 7-11KB) — implementation. Load only when implementing. Contains: fetch docs, decision trees, one code example, verification commands, error recovery.

API reference skills use lightweight stubs (`workos-api-sso.guide.md`, ~1KB) — endpoint table + doc pointer.

**Load the summary first.** Only read the guide when the agent is ready to implement.

## File Layout

```
skills/workos/
├── SKILL.md                              # Router — start here
├── workos-integrations.md                # Provider lookup (60+ IdPs)
│
├── workos-sso.md                         # Summary (routing doc)
├── workos-sso.guide.md                   # Guide (implementation)
├── workos-directory-sync.md / .guide.md
├── workos-rbac.md / .guide.md
├── workos-vault.md / .guide.md
├── workos-events.md / .guide.md
├── workos-audit-logs.md / .guide.md
├── workos-admin-portal.md / .guide.md
├── workos-mfa.md / .guide.md
├── workos-custom-domains.md / .guide.md
├── workos-email.md / .guide.md
├── workos-widgets.md / .guide.md
│
├── workos-migrate-auth0.md / .guide.md   # Migration skills
├── workos-migrate-firebase.md / .guide.md
├── workos-migrate-clerk.md / .guide.md
├── ...
│
├── workos-api-sso.md / .guide.md         # API ref (summary + stub)
├── workos-api-authkit.md / .guide.md
├── ...
│
└── workos-directory-sync.feedback.md     # Domain expert feedback (5 files)
```

## Skill Patterns

### Summaries (<1KB)

```markdown
---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

## When to Use

2-3 sentences positioning the feature.

## Key Vocabulary

- **Organization** `org_` — tenant entity
- **Connection** `conn_` — link to an identity provider

## Implementation Guide

→ Read `skills/workos/workos-sso.guide.md`

## Related Skills

- **workos-rbac**: Role-based access after SSO
```

### Guides (7-11KB)

1. **Step 1: Fetch Documentation (BLOCKING)** — WebFetch doc URLs before proceeding
2. **Pre-flight validation** — check env vars, SDK installation, project structure
3. **Decision trees** — conditional flows for implementation choices
4. **One code example** — language-agnostic SDK pattern (10-25 lines)
5. **Verification checklist** — runnable bash commands to confirm success
6. **Error recovery** — specific error messages mapped to root causes and fixes
7. **Related skills** — cross-references to other WorkOS skills

### API Reference Stubs (~1KB)

Endpoint table + doc pointer + link to feature guide. No implementation details.

## Key Principle

Skills reference doc URLs for **runtime WebFetch** — they don't paste documentation content. The agent fetches the latest docs when executing the skill. If a skill conflicts with fetched docs, follow the docs.
