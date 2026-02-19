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

### Feature skill vs API reference
- **Default**: Route to feature skill (e.g., `workos-sso.md`) for implementation questions.
- **Route to API reference** ONLY when user explicitly asks about:
  - HTTP endpoints, request/response formats, or REST API details
  - "API documentation" or "API reference"
  - SDK method signatures for a specific language
- **Edge case**: If user says "how do I call the SSO API" but means "how do I implement SSO", clarify their intent before routing.

### AuthKit vs feature-specific skills
- **Route to AuthKit** when user mentions:
  - Authentication, login, sign-up, sign-out, or session management
  - "set up auth" or "add authentication"
  - User management, password reset, or email verification
- **Route to feature skill** when user explicitly mentions:
  - SSO, MFA, Directory Sync, Audit Logs, Admin Portal, or other named features
  - "configure SSO" or "add multi-factor auth" (these are post-AuthKit features)
- **If ambiguous**: Assume AuthKit for generic "auth" questions, but ask if user needs a specific feature.

### Migration vs fresh setup
- **Route to migration skill** when user mentions:
  - "migrate from [provider]"
  - "switch from [provider]"
  - "already using [provider]"
  - Existing auth system, user data export, or password hash import
- **Route to fresh setup** for greenfield projects or when no existing system is mentioned.

### Multiple features mentioned
- **Route to most specific skill first**. Examples:
  - "SSO and MFA" → Route to `workos-sso.md` first (more complex setup)
  - "AuthKit with SSO" → Route to AuthKit first (foundation), then mention SSO skill
  - "Audit Logs and Events" → Route to `workos-audit-logs.md` (Events is lower-level)
- Tell user they can load additional skills after completing the first one.

### Overlapping feature detection
- **Admin Portal vs Widgets**: Admin Portal is for end-user self-service. Widgets is for embedding UI components. If user wants "admin UI", clarify which one.
- **Events vs feature-specific webhooks**: Route to feature skill if user mentions webhooks for a specific feature (e.g., "SSO webhooks" → `workos-sso.md`). Route to `workos-events.md` only for general webhook architecture or event type references.
- **Directory Sync vs Integrations**: Directory Sync is for syncing user directories (SCIM). Integrations is for IdP setup. If user says "Okta integration", ask if they mean SSO setup or directory sync.

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
1. @tanstack/start in package.json     → Skill tool: workos-authkit-tanstack-start
2. react-router-dom in package.json    → Skill tool: workos-authkit-react-router
3. next.config.* file exists           → Skill tool: workos-authkit-nextjs
4. vite.config.* + react in deps       → Skill tool: workos-authkit-react
5. No framework detected               → Skill tool: workos-authkit-vanilla-js
```

**Priority rationale**: TanStack and React Router are additive frameworks that may coexist with Next.js or Vite. Check them FIRST to avoid misrouting projects that use both.

**Edge cases**:
- **Remix**: Not explicitly supported. Route to `workos-authkit-base` and tell user to check docs for Remix setup.
- **SvelteKit / Astro / others**: Route to `workos-authkit-vanilla-js` and note that SDK integration may differ.
- **Monorepo**: Ask user which workspace needs AuthKit before scanning deps.

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Migration context? (mentions "migrate from", "switch from", "export users")
  |     → Read skills/workos/workos-migrate-[provider].md
  |     → If provider not listed, use workos-migrate-other-services.md
  |
  +-- Mentions specific feature? (SSO, MFA, Directory Sync, Audit Logs, etc.)
  |     → Read skills/workos/workos-[feature].md
  |     → If multiple features mentioned, route to most foundational first
  |
  +-- Explicitly asks for API reference? ("API docs", "REST endpoints", "request format")
  |     → Read skills/workos/workos-api-[feature].md
  |     → If no API skill exists for topic, WebFetch https://workos.com/docs/reference
  |
  +-- Wants AuthKit/auth setup? ("add auth", "login", "sign-up")
  |     → Detect framework (see AuthKit Installation Detection above)
  |     → Skill tool: workos-authkit-[framework]
  |
  +-- Wants integration setup? ("connect Okta", "SAML provider", "IdP")
  |     → Clarify: SSO setup or Directory Sync?
  |     → SSO: Read skills/workos/workos-sso.md
  |     → Directory Sync: Read skills/workos/workos-directory-sync.md
  |
  +-- Vague request ("help with WorkOS", "how does WorkOS work")
  |     → Ask user to clarify: authentication, specific feature, or migration?
  |     → If still vague, WebFetch https://workos.com/docs/llms.txt → find matching section
  |
  +-- No clear match
        → WebFetch https://workos.com/docs/llms.txt
        → WebFetch specific section URL for user's topic
```

## If No Skill Matches

1. WebFetch the full docs index: `https://workos.com/docs/llms.txt`
2. Scan for the section that best matches the user's request.
3. WebFetch the specific section URL.
4. If still no match, ask user to rephrase or clarify their goal.
