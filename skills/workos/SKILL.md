---
name: workos
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:b0741504a07b -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult the tables below to route to the right skill.

## Loading Skills

**AuthKit skills** are registered plugins — load them directly via the Skill tool.

**All other skills** are bundled files. To load one, Read `skills/workos/{name}.md` from this plugin directory and follow its instructions.

## Disambiguation Rules

### 1. Feature skill vs API reference
**Prefer feature skills** (e.g., `workos-sso`) unless the user explicitly:
- Asks about "API endpoints", "API reference", or "REST API"
- Mentions request/response formats, HTTP methods, or status codes
- Says "how do I call the API" or "what endpoints are available"

When in doubt: feature skill first. API references are for developers who already know the feature and need endpoint details.

### 2. AuthKit vs feature-specific skills
**Route to AuthKit** if the user mentions:
- "authentication", "login", "sign-up", "sign-in", "logout", "session management"
- "install auth", "add auth", "user authentication"

**Route to feature skill** if the user mentions a specific WorkOS product by name:
- SSO, SAML, OIDC → `workos-sso`
- MFA, 2FA, TOTP → `workos-mfa`
- RBAC, roles, permissions → `workos-rbac`
- Directory Sync, SCIM → `workos-directory-sync`

**Edge case**: "SSO with AuthKit" → Load AuthKit first (it handles SSO integration automatically)

### 3. Multiple features mentioned
Route to the **most specific skill first**. Examples:
- "SSO and MFA" → Load `workos-sso` first (it will mention MFA as an add-on)
- "Audit logs and webhooks" → Load `workos-audit-logs` first (webhooks are covered in Events)
- "Roles and Admin Portal" → Load `workos-rbac` first (Admin Portal is for customer management)

The user can request additional skills after completing the first.

### 4. Migration context
If the user mentions migrating FROM another service, **check provider name first**:
- Mentions "Clerk", "Auth0", "Cognito", "Supabase", etc. → Use exact migration skill
- Mentions "Firebase" → Use Firebase migration (NOT generic)
- Says "migrate from [unknown provider]" → Use `workos-migrate-other-services`

Migration skills take priority over feature skills when migration is the explicit goal.

## Topic → Skill Map

### AuthKit (load via Skill tool)

| User wants to...                              | Skill tool name                     |
| --------------------------------------------- | ----------------------------------- |
| Install AuthKit in Next.js                    | workos-authkit-nextjs               |
| Install AuthKit in React SPA                  | workos-authkit-react                |
| Install AuthKit with React Router             | workos-authkit-react-router         |
| Install AuthKit with TanStack Start           | workos-authkit-tanstack-start       |
| Install AuthKit in vanilla JS                 | workos-authkit-vanilla-js           |
| AuthKit architecture reference                | workos-authkit-base                 |

### Features (Read `skills/workos/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Configure email delivery                      | `skills/workos/workos-email.md` |
| Add WorkOS Widgets                            | `skills/workos/workos-widgets.md` |
| Encrypt data with Vault                       | `skills/workos/workos-vault.md` |
| Configure Single Sign-On                      | `skills/workos/workos-sso.md` |
| Implement RBAC / roles                        | `skills/workos/workos-rbac.md` |
| Add Multi-Factor Auth                         | `skills/workos/workos-mfa.md` |
| Set up IdP integration                        | `skills/workos/workos-integrations.md` |
| Handle WorkOS Events / webhooks               | `skills/workos/workos-events.md` |
| Set up Directory Sync                         | `skills/workos/workos-directory-sync.md` |
| Set up Custom Domains                         | `skills/workos/workos-custom-domains.md` |
| Set up Audit Logs                             | `skills/workos/workos-audit-logs.md` |
| Enable Admin Portal                           | `skills/workos/workos-admin-portal.md` |

### API References (Read `skills/workos/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Admin portal API Reference                    | `skills/workos/workos-api-admin-portal.md` |
| Audit logs API Reference                      | `skills/workos/workos-api-audit-logs.md` |
| Authkit API Reference                         | `skills/workos/workos-api-authkit.md` |
| Directory sync API Reference                  | `skills/workos/workos-api-directory-sync.md` |
| Events API Reference                          | `skills/workos/workos-api-events.md` |
| Organization API Reference                    | `skills/workos/workos-api-organization.md` |
| Roles API Reference                           | `skills/workos/workos-api-roles.md` |
| Sso API Reference                             | `skills/workos/workos-api-sso.md` |
| Vault API Reference                           | `skills/workos/workos-api-vault.md` |
| Widgets API Reference                         | `skills/workos/workos-api-widgets.md` |

### Migrations (Read `skills/workos/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Migrate from Supabase Auth                   | `skills/workos/workos-migrate-supabase-auth.md` |
| Migrate from Stytch                          | `skills/workos/workos-migrate-stytch.md` |
| Migrate from the standalone SSO API          | `skills/workos/workos-migrate-the-standalone-sso-api.md` |
| Migrate from other services                  | `skills/workos/workos-migrate-other-services.md` |
| Migrate from Firebase                        | `skills/workos/workos-migrate-firebase.md` |
| Migrate from Descope                         | `skills/workos/workos-migrate-descope.md` |
| Migrate from Clerk                           | `skills/workos/workos-migrate-clerk.md` |
| Migrate from Better Auth                     | `skills/workos/workos-migrate-better-auth.md` |
| Migrate from AWS Cognito                     | `skills/workos/workos-migrate-aws-cognito.md` |
| Migrate from Auth0                           | `skills/workos/workos-migrate-auth0.md` |

## AuthKit Installation Detection

If the user wants to install AuthKit, detect their framework. Check in this order (first match wins):

```
1. @tanstack/start in deps     → Skill tool: workos-authkit-tanstack-start
2. react-router-dom in deps    → Skill tool: workos-authkit-react-router
3. next.config.* file exists    → Skill tool: workos-authkit-nextjs
4. vite.config.* + react in deps → Skill tool: workos-authkit-react
5. No framework detected        → Skill tool: workos-authkit-vanilla-js
```

**Why this order?** TanStack Start and React Router are framework-specific (check first). Next.js and Vite+React are more generic (check second). Vanilla JS is the fallback.

**Edge case**: If the user has BOTH Next.js and React Router installed, ask which one they want to use. Do NOT guess.

**Verification**: After routing, confirm the skill loaded the right framework. If the user says "this isn't my setup", re-detect.

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Explicit migration? ("migrate from X")
  |   → Check provider name in migrations table
  |   → If unlisted → Read skills/workos/workos-migrate-other-services.md
  |
  +-- Mentions specific WorkOS product by name? (SSO, MFA, RBAC, etc.)
  |   → Read skills/workos/workos-[feature].md
  |
  +-- Asks for API reference explicitly? ("API docs", "endpoints", "request format")
  |   → Read skills/workos/workos-api-[feature].md
  |
  +-- Mentions authentication setup? ("login", "sign-up", "auth")
  |   → Detect framework → Skill tool: workos-authkit-[framework]
  |
  +-- Wants integration setup? ("connect IdP", "configure SAML")
  |   → Read skills/workos/workos-integrations.md
  |
  +-- Vague request? ("help with WorkOS", "getting started")
  |   → Ask: "What are you trying to build?" (auth, SSO, audit logs, etc.)
  |   → Then route based on their answer
  |
  +-- Still unclear? → WebFetch https://workos.com/docs/llms.txt → Find matching section
```

## Edge Cases

### User mentions multiple features
Example: "I need SSO and MFA and audit logs"

1. Route to the PRIMARY feature (SSO in this case)
2. After completing SSO setup, ask: "Ready to add MFA next?"
3. Load additional skills sequentially

DO NOT load multiple skills simultaneously — it creates confusion.

### User has an existing WorkOS setup
If they say "I already have WorkOS SSO" or "we're already using AuthKit":
- Ask what they want to ADD or CHANGE
- Route to the incremental skill (e.g., "add MFA" → `workos-mfa`)
- DO NOT re-load AuthKit if they already have it

### Framework detection fails
If no framework can be detected for AuthKit:
1. Ask: "What framework are you using?" (Next.js, React, vanilla JS, etc.)
2. Route based on their answer
3. If they say "none" or "HTML/JS" → Use `workos-authkit-vanilla-js`

### Unknown provider in migration
If the user wants to migrate from a provider not listed:
1. Load `skills/workos/workos-migrate-other-services.md`
2. The skill will guide them through generic migration steps
3. If they need provider-specific help, defer to WorkOS support

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.

This happens when:
- The user asks about a WorkOS feature not covered by existing skills
- They reference WorkOS concepts not in the skill map
- The request is too vague to route (ask clarifying questions first)
