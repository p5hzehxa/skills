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

### Feature vs API Reference
- **Default**: Route to feature skills (e.g., `workos-sso.md`). These explain WHAT the feature does and WHEN to use it.
- **API Reference**: Only route to `workos-api-*.md` files when the user explicitly asks about:
  - API endpoints, HTTP methods, or request/response formats
  - SDK method signatures or parameter schemas
  - Rate limits, error codes, or API versioning
  - References "API docs" or "API reference" explicitly

### AuthKit vs Specific Feature
- **AuthKit**: Route to AuthKit skills when the user mentions:
  - Authentication, login, sign-up, or session management
  - User management (create/update/delete users)
  - Email/password auth or magic links
  - "Set up auth" or "add authentication"
  
- **Specific Feature**: Route to feature skills when the user explicitly mentions:
  - SSO, SAML, OAuth, or "enterprise login"
  - MFA, TOTP, or "two-factor"
  - RBAC, roles, permissions, or "access control"
  - Directory Sync, SCIM, or "user provisioning"
  - Audit Logs, Events, Webhooks, Vault, Widgets, Custom Domains

- **Tiebreaker**: If the user mentions both (e.g., "add SSO to my auth flow"), route to the specific feature skill. The feature skill will reference AuthKit where needed.

### Multiple Features in One Request
- Route to the MOST SPECIFIC skill first based on primary intent
- If the user mentions 2+ unrelated features (e.g., "add SSO and Directory Sync"), route to the first one detected in table order (SSO before Directory Sync)
- After completing the first skill, ask: "Would you like to add [other feature] next?"

### Migration Context
- If the user mentions migrating from another provider (Auth0, Cognito, Clerk, etc.), route to the migration skill FIRST
- Migration skills cover feature setup within the migration context — do NOT route to separate feature skills unless the user explicitly asks

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
2. react-router in deps         → Skill tool: workos-authkit-react-router
3. next.config.*                → Skill tool: workos-authkit-nextjs
4. vite.config.* + react in deps → Skill tool: workos-authkit-react
5. No framework detected         → Skill tool: workos-authkit-vanilla-js
```

**Edge cases**:
- If TanStack Start + React Router detected, TanStack wins (more specific)
- If Next.js + React Router detected, Next.js wins (Next has built-in routing)
- If user has both Vite and Next configs, ask which framework they're using
- If deps are unclear, ask: "Are you using Next.js, React (SPA), React Router, TanStack Start, or vanilla JS?"

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Migration context detected?
  |   (mentions Auth0, Cognito, Clerk, Supabase, etc.)
  |   → Read skills/workos/workos-migrate-[provider].md
  |   → If provider not in table, Read skills/workos/workos-migrate-other-services.md
  |
  +-- Explicit API reference request?
  |   (mentions "API docs", "endpoints", "request format", "SDK methods")
  |   → Read skills/workos/workos-api-[feature].md
  |
  +-- Specific feature mentioned by name?
  |   (SSO, MFA, Directory Sync, RBAC, Audit Logs, Events, Vault, Widgets, Custom Domains, Admin Portal)
  |   → Read skills/workos/workos-[feature].md
  |
  +-- Authentication/login/sign-up request?
  |   → Detect framework → Skill tool: workos-authkit-[framework]
  |   → If framework unclear, ask user to clarify
  |
  +-- Integration setup?
  |   (mentions connecting to Okta, OneLogin, Google Workspace, Azure AD, etc.)
  |   → Read skills/workos/workos-integrations.md
  |
  +-- Email delivery configuration?
  |   (mentions transactional emails, magic links, email templates)
  |   → Read skills/workos/workos-email.md
  |
  +-- Vague or unclear request?
  |   → WebFetch https://workos.com/docs/llms.txt
  |   → Identify matching section from index
  |   → WebFetch specific section URL
  |   → Route to appropriate skill based on fetched content
```

## Edge Cases

### User Says "Set Up WorkOS" (No Specific Feature)
1. Ask: "What WorkOS feature would you like to set up? Common options: AuthKit (login/signup), SSO, Directory Sync, RBAC, MFA, Audit Logs"
2. Route based on their answer

### User Mentions Multiple Unrelated Features
- **Example**: "Add SSO and Audit Logs"
- **Action**: "I'll help you set up SSO first. After that's complete, we can add Audit Logs. Sound good?"
- Route to SSO skill immediately

### Framework Cannot Be Detected
- **Example**: No package.json, no config files
- **Action**: Ask: "What framework are you using? (Next.js / React SPA / React Router / TanStack Start / Vanilla JS)"
- Wait for response before routing to AuthKit skill

### User Mentions Both AuthKit and Specific Feature
- **Example**: "Add SSO to my AuthKit setup"
- **Action**: Route to SSO skill (more specific). The SSO skill will reference AuthKit integration points.

### Provider Not in Migration Table
- **Example**: "Migrate from Keycloak"
- **Action**: Read `skills/workos/workos-migrate-other-services.md` (generic migration guide)

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt

Then:
1. Identify the relevant section from the index
2. WebFetch the specific section URL
3. Based on fetched content, route to the appropriate skill
4. If still unclear, summarize the fetched docs and ask the user to clarify their goal
