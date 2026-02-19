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
- **Prefer feature skills** (e.g., `workos-sso.md`) for implementation questions: "How do I set up X?", "Help me configure Y"
- **Route to API reference** only when user explicitly asks about:
  - API endpoints, request/response formats
  - SDK method signatures or parameters
  - References "API docs", "API reference", or "endpoint documentation"
- **If unclear**: Start with feature skill. It will reference the API skill if needed.

### AuthKit vs specific feature
- **Route to AuthKit** if user mentions:
  - Authentication, login, sign-up, sign-in, logout
  - Session management, user management
  - "Auth setup", "authentication flow"
- **Route to feature skill** if user explicitly names:
  - SSO, MFA, Directory Sync, RBAC, Audit Logs, etc.
  - Integration with a specific IdP
- **If user mentions BOTH** (e.g., "AuthKit with SSO"):
  1. Load AuthKit skill for framework
  2. Then load SSO feature skill for configuration

### Multiple features mentioned
- Route to the **most specific** skill first
- If user mentions 2+ features at equal specificity (e.g., "SSO and Directory Sync"), ask which to start with
- User can load additional skills after completing first task

### Migration vs fresh setup
- **Route to migration skill** if user mentions:
  - "Migrating from X", "switching from Y", "replacing Z"
  - Existing provider names (Auth0, Cognito, Clerk, etc.)
  - User data export, password migration, provider comparison
- **Route to fresh setup** (AuthKit or feature skill) if:
  - No existing provider mentioned
  - User says "new project", "starting fresh", "greenfield"

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

**Priority rationale**: TanStack Start and React Router projects often use Vite, so check their specific packages BEFORE checking for Next.js or generic Vite+React setup. This prevents misrouting a React Router app as a generic React SPA.

**Ambiguous cases**:
- **User mentions framework name but no config files found**: Ask user to confirm framework, then route accordingly. Do NOT guess.
- **Multiple frameworks detected** (e.g., Next.js config + React Router deps): Ask user which framework they're using for this project.
- **User says "React" without more context**: Check for framework-specific files first. If none found, route to `workos-authkit-react` (generic React SPA).

## General Decision Flow

```
User request about WorkOS?
  |
  +-- Is this a migration? (mentions existing provider, "migrating from", "switching from")
  |   → Read skills/workos/workos-migrate-[provider].md
  |   → If provider not in table, use workos-migrate-other-services.md
  |
  +-- Does user mention specific feature by name? (SSO, MFA, RBAC, Directory Sync, etc.)
  |   → Read skills/workos/workos-[feature].md
  |
  +-- Does user explicitly ask for API reference? (endpoints, request/response, SDK methods)
  |   → Read skills/workos/workos-api-[feature].md
  |
  +-- Is this about authentication/login/sessions? (AuthKit territory)
  |   → Detect framework (see section above)
  |   → Skill tool: workos-authkit-[framework]
  |
  +-- Is this about IdP integration setup? (Okta, Azure AD, Google Workspace)
  |   → Read skills/workos/workos-integrations.md
  |
  +-- Is this about webhooks or event handling?
  |   → Read skills/workos/workos-events.md
  |
  +-- Request is vague or ambiguous?
  |   → Ask clarifying question: "Are you setting up [feature], migrating from another service, or looking for API reference?"
  |   → If still unclear: WebFetch https://workos.com/docs/llms.txt → Find matching section
```

## Edge Cases

### User mentions multiple features
Example: "I need SSO and Directory Sync"
1. Ask: "Let's start with one. Which would you like to configure first: SSO or Directory Sync?"
2. Load that skill
3. After completion, load second skill

### User's framework cannot be detected
1. Run detection flow (see AuthKit Installation Detection section)
2. If no framework files found, ask: "Which framework are you using? (Next.js, React, React Router, TanStack Start, or vanilla JS)"
3. Route based on user's answer

### User asks "How do I use WorkOS?" (extremely vague)
1. Ask: "What are you trying to accomplish? For example:
   - Set up authentication (login/signup)
   - Configure enterprise SSO
   - Migrate from another auth provider
   - Something else?"
2. Route based on clarified intent

### User mentions AuthKit AND a specific feature
Example: "Set up AuthKit with Google SSO"
1. Load AuthKit skill for user's framework (to set up base auth)
2. Then load `workos-sso.md` (to configure SSO)
3. SSO skill will reference how to integrate with AuthKit

### User asks about WorkOS but no table match
1. WebFetch https://workos.com/docs/llms.txt
2. Search for relevant section
3. If section found: WebFetch that specific URL
4. If no section found: Ask user for more details about their use case

## If No Skill Matches

WebFetch the full docs index: https://workos.com/docs/llms.txt
Then WebFetch the specific section URL for the user's topic.
