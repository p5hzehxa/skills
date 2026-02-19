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
- **Default**: Route to feature skills (e.g., `workos-sso`) for implementation guidance.
- **Override**: Route to API references only when the user explicitly asks about:
  - API endpoints, request/response formats, or HTTP methods
  - "API docs" or "API reference"
  - SDK method signatures or parameters

### AuthKit vs named features
- **AuthKit wins** if the user mentions authentication, login, sign-up, session management, or "getting started" WITHOUT naming a specific feature.
- **Named feature wins** if the user explicitly mentions SSO, MFA, Directory Sync, Audit Logs, RBAC, etc., even if the context is authentication.
- **Example**: "add SSO to my app" → workos-sso, not AuthKit.

### Migration vs implementation
- **Migration wins** if the user mentions:
  - Switching from another provider (Auth0, Clerk, Cognito, etc.)
  - "Migrate" or "migration"
  - Importing users or data from another system
- **Implementation wins** for greenfield setup or adding new features to existing WorkOS setup.

### Multiple features mentioned
1. Route to the MOST SPECIFIC skill first.
2. If user mentions both a feature AND AuthKit (e.g., "add SSO with AuthKit"), route to the feature skill — it will reference AuthKit where relevant.
3. If two features are equally specific, ask the user which to start with.

### Ambiguous framework context
- If a user says "React app" but you can't determine if it's Next.js, React Router, TanStack Start, or vanilla SPA, ASK before routing.
- Do NOT guess — ambiguous routing causes failed integrations.

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
3. next.config.* exists                → Skill tool: workos-authkit-nextjs
4. vite.config.* + react in deps       → Skill tool: workos-authkit-react
5. No framework detected               → Skill tool: workos-authkit-vanilla-js
```

**Detection traps**:
- TanStack Start projects often include React — check for `@tanstack/start` FIRST to avoid misrouting to React SPA.
- React Router v6+ uses `react-router-dom` — check for this package, not `react-router` alone.
- Next.js projects may also have Vite installed — `next.config.*` presence takes precedence.
- If `package.json` is not in the working directory, ASK the user which framework they're using — do NOT guess.

## General Decision Flow

```
User request about WorkOS?
  |
  ├─ Mentions migration/switching providers?
  │    → Read skills/workos/workos-migrate-[provider].md
  │    → If provider not in table, read workos-migrate-other-services.md
  │
  ├─ Names a specific feature (SSO, MFA, Directory Sync, etc.)?
  │    ├─ Asks about API/endpoints/request format?
  │    │    → Read skills/workos/workos-api-[feature].md
  │    │
  │    └─ Wants implementation/setup?
  │         → Read skills/workos/workos-[feature].md
  │
  ├─ Wants AuthKit/authentication without naming a feature?
  │    ├─ Framework detectable?
  │    │    → Run AuthKit Installation Detection
  │    │    → Skill tool: workos-authkit-[framework]
  │    │
  │    └─ Framework ambiguous?
  │         → ASK: "Are you using Next.js, React SPA, React Router, TanStack Start, or vanilla JS?"
  │
  ├─ Wants integration/IdP setup?
  │    → Read skills/workos/workos-integrations.md
  │
  ├─ Mentions multiple features?
  │    → Route to MOST SPECIFIC skill first
  │    → Tell user they can load additional skills afterward
  │
  └─ Request is vague or doesn't match any skill?
       → WebFetch https://workos.com/docs/llms.txt
       → Find matching section
       → WebFetch that section's URL
```

## Edge Cases

### User mentions both feature AND AuthKit
Route to the FEATURE skill — it will reference AuthKit integration where relevant.
Example: "set up SSO with AuthKit" → workos-sso, not workos-authkit-nextjs.

### User says "API" but means "how do I use X"
If context suggests they want IMPLEMENTATION (not endpoint reference), clarify:
"Are you asking how to implement [feature], or do you need the API endpoint reference?"

### No skill exists for the topic
1. WebFetch https://workos.com/docs/llms.txt
2. Search for relevant section
3. WebFetch that section's URL
4. If still no match, tell user: "This topic isn't covered by available skills. I can fetch WorkOS docs directly — what specific question do you have?"

### User has ALREADY loaded AuthKit and now asks about a feature
Route to the FEATURE skill — do NOT reload AuthKit unless user explicitly asks.

## If No Skill Matches

1. WebFetch https://workos.com/docs/llms.txt
2. Search the index for keywords matching the user's request
3. WebFetch the most relevant section URL
4. If no section matches, ask the user to clarify their request
