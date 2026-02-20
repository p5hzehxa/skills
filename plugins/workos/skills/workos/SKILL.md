---
name: workos
description: "Identify which WorkOS skill to load based on the user's task. Covers AuthKit, SSO, RBAC, migrations, and all API references."
---

<!-- refined:sha256:b0741504a07b -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult the tables below to route to the right skill.

## Loading Skills

**AuthKit skills** are registered plugins — load them directly via the Skill tool.

**All other skills** are bundled files. To load one, Read `references/{name}.md` from this plugin directory and follow its instructions.

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

### Features (Read `references/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Configure email delivery                      | `references/workos-email.md` |
| Add WorkOS Widgets                            | `references/workos-widgets.md` |
| Encrypt data with Vault                       | `references/workos-vault.md` |
| Configure Single Sign-On                      | `references/workos-sso.md` |
| Implement RBAC / roles                        | `references/workos-rbac.md` |
| Add Multi-Factor Auth                         | `references/workos-mfa.md` |
| Set up IdP integration                        | `references/workos-integrations.md` |
| Handle WorkOS Events / webhooks               | `references/workos-events.md` |
| Set up Directory Sync                         | `references/workos-directory-sync.md` |
| Set up Custom Domains                         | `references/workos-custom-domains.md` |
| Set up Audit Logs                             | `references/workos-audit-logs.md` |
| Enable Admin Portal                           | `references/workos-admin-portal.md` |

### API References (Read `references/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Admin portal API Reference                    | `references/workos-api-admin-portal.md` |
| Audit logs API Reference                      | `references/workos-api-audit-logs.md` |
| Authkit API Reference                         | `references/workos-api-authkit.md` |
| Directory sync API Reference                  | `references/workos-api-directory-sync.md` |
| Events API Reference                          | `references/workos-api-events.md` |
| Organization API Reference                    | `references/workos-api-organization.md` |
| Roles API Reference                           | `references/workos-api-roles.md` |
| Sso API Reference                             | `references/workos-api-sso.md` |
| Vault API Reference                           | `references/workos-api-vault.md` |
| Widgets API Reference                         | `references/workos-api-widgets.md` |

### Migrations (Read `references/{name}.md`)

| User wants to...                              | Read file                                       |
| --------------------------------------------- | ----------------------------------------------- |
| Migrate from Supabase Auth                   | `references/workos-migrate-supabase-auth.md` |
| Migrate from Stytch                          | `references/workos-migrate-stytch.md` |
| Migrate from the standalone SSO API          | `references/workos-migrate-the-standalone-sso-api.md` |
| Migrate from other services                  | `references/workos-migrate-other-services.md` |
| Migrate from Firebase                        | `references/workos-migrate-firebase.md` |
| Migrate from Descope                         | `references/workos-migrate-descope.md` |
| Migrate from Clerk                           | `references/workos-migrate-clerk.md` |
| Migrate from Better Auth                     | `references/workos-migrate-better-auth.md` |
| Migrate from AWS Cognito                     | `references/workos-migrate-aws-cognito.md` |
| Migrate from Auth0                           | `references/workos-migrate-auth0.md` |

## Disambiguation Rules

### Priority Order (Check Top to Bottom)

1. **Migration context wins** — If the user mentions "migrate from [provider]" or "switching from [provider]", route to the migration skill FIRST, even if they also mention features. Migration skills contain provider-specific guidance that feature skills don't.

2. **Explicit API reference requests** — If the user says "API docs", "API reference", "endpoint", "request format", "response schema", or asks about HTTP methods, route to the API reference skill.

3. **Feature-specific keywords** — If the user mentions a feature by name (SSO, MFA, Directory Sync, Audit Logs, etc.), route to the feature skill. Feature skills contain setup and integration patterns; API skills contain request/response details.

4. **AuthKit as fallback for auth terms** — If the user says "authentication", "login", "sign-up", "sign-in", or "auth" WITHOUT mentioning a specific feature, route to AuthKit. If they say "SSO" or "MFA" explicitly, route to those feature skills instead (SSO and MFA have their own setup flows beyond AuthKit).

### Overlapping Intent Resolution

- **"Set up SSO" vs "SSO API"** → Feature skill (`workos-sso.md`) wins unless user says "API" explicitly.
- **"AuthKit + SSO"** → Route to AuthKit first (SSO is integrated into AuthKit's flow). User can load SSO skill later if they need advanced configuration.
- **"Events + webhooks"** → Same skill (`workos-events.md`) — these terms are synonymous in WorkOS.
- **"Admin Portal + Directory Sync"** → Route to Directory Sync first (Admin Portal is the UI layer; Directory Sync is the integration). User can load Admin Portal skill later for UI customization.
- **"Roles + RBAC"** → Same skill (`workos-rbac.md`) — roles are the WorkOS implementation of RBAC.

### Multiple Features in One Request

If the user mentions multiple features ("I want SSO and MFA"):
1. Route to the FIRST feature mentioned.
2. After loading that skill, inform the user: "Loaded [Feature 1]. To add [Feature 2], say 'load [Feature 2 skill name].'"

Do NOT attempt to load multiple skills simultaneously — each skill may have conflicting setup steps or assumptions.

### Vague or Underspecified Requests

- **"I need authentication"** → Detect framework → Load AuthKit skill.
- **"I need WorkOS"** → Ask: "What WorkOS feature? (e.g., SSO, MFA, Directory Sync, Audit Logs)" OR load AuthKit if the project has no WorkOS code yet.
- **"How do I integrate WorkOS?"** → Check if project has existing WorkOS code (search for `WORKOS_` env vars or `@workos-inc/` imports). If yes, ask what they want to add. If no, route to AuthKit.
- **"WorkOS setup"** → Same as "I need WorkOS" above.

## AuthKit Installation Detection

If the user wants to install AuthKit (or you routed to AuthKit via disambiguation), detect their framework. Check in this order (first match wins):

```
1. @tanstack/start in package.json dependencies      → workos-authkit-tanstack-start
2. react-router OR react-router-dom in dependencies  → workos-authkit-react-router
3. next.config.js OR next.config.mjs in root         → workos-authkit-nextjs
4. vite.config.* in root AND react in dependencies   → workos-authkit-react
5. None of the above detected                        → workos-authkit-vanilla-js
```

**Framework Detection Edge Cases:**

- **Project has BOTH Next.js and React Router** → Next.js wins (step 3 before step 2). Next.js projects sometimes install react-router as a transitive dep.
- **Project has BOTH TanStack Start and React Router** → TanStack Start wins (step 1 before step 2). TanStack Start projects always have react-router as a dep.
- **Project has Vite but no React** → Vanilla JS (step 5). Vite can be used with vanilla JS or other frameworks.
- **Cannot determine framework** → Ask: "What framework are you using? (Next.js, React, React Router, TanStack Start, or none)" then route accordingly.

Do NOT guess if framework detection fails. Ask the user explicitly.

## General Decision Flow

```
User request about WorkOS
  |
  ├─ Mentions "migrate from [provider]"?
  │    YES → Read references/workos-migrate-[provider].md
  │    NO  → Continue
  |
  ├─ Says "API docs", "endpoint", "API reference", or "request/response"?
  │    YES → Read references/workos-api-[feature].md
  │    NO  → Continue
  |
  ├─ Mentions specific feature (SSO, MFA, Directory Sync, etc.)?
  │    YES → Read references/workos-[feature].md
  │    NO  → Continue
  |
  ├─ Mentions "authentication", "login", "sign-up", or "AuthKit"?
  │    YES → Detect framework → Skill tool: workos-authkit-[framework]
  │    NO  → Continue
  |
  ├─ Mentions "integration" or "IdP connection"?
  │    YES → Read references/workos-integrations.md
  │    NO  → Continue
  |
  ├─ Request is vague ("I need WorkOS", "WorkOS setup")?
  │    YES → Check if project has WORKOS_ env vars or @workos-inc/ imports
  │           - If YES: Ask "What WorkOS feature do you want to add?"
  │           - If NO:  Detect framework → Skill tool: workos-authkit-[framework]
  │    NO  → Continue
  |
  └─ No match found
       → WebFetch https://workos.com/docs/llms.txt
       → Search index for user's topic
       → WebFetch the section URL
       → Summarize findings and suggest relevant skill if applicable
```

## If No Skill Matches

1. WebFetch the full docs index: `https://workos.com/docs/llms.txt`
2. Search the index for keywords from the user's request.
3. WebFetch the most relevant section URL.
4. Summarize the documentation and determine if a skill should be loaded.
5. If a skill applies, route to it. Otherwise, answer from fetched docs.

Do NOT fabricate answers if no skill matches and docs cannot be fetched.
