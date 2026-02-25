---
name: workos
description: Identify which WorkOS skill to load based on the user's task — covers AuthKit, SSO, RBAC, migrations, and all API references.
---

<!-- refined:sha256:aad444a2aecb -->

# WorkOS Skill Router

## How to Use

When a user needs help with WorkOS, consult the tables below to route to the right skill.

## Loading Skills

**AuthKit skills** are registered plugins — load them directly via the Skill tool.

**All other skills** are bundled in the `references/` directory. To load one, Read `references/{name}.md` and follow its instructions.

## Topic → Skill Map

### AuthKit (load via Skill tool)

| User wants to...                    | Skill tool name               |
| ----------------------------------- | ----------------------------- |
| Install AuthKit in Next.js          | workos-authkit-nextjs         |
| Install AuthKit in React SPA        | workos-authkit-react          |
| Install AuthKit with React Router   | workos-authkit-react-router   |
| Install AuthKit with TanStack Start | workos-authkit-tanstack-start |
| Install AuthKit in vanilla JS       | workos-authkit-vanilla-js     |
| AuthKit architecture reference      | workos-authkit-base           |

### Features (Read `references/{name}.md`)

| User wants to...                | Read file                             |
| ------------------------------- | ------------------------------------- |
| Configure email delivery        | `references/workos-email.md`          |
| Add WorkOS Widgets              | `references/workos-widgets.md`        |
| Encrypt data with Vault         | `references/workos-vault.md`          |
| Configure Single Sign-On        | `references/workos-sso.md`            |
| Implement RBAC / roles          | `references/workos-rbac.md`           |
| Add Multi-Factor Auth           | `references/workos-mfa.md`            |
| Set up IdP integration          | `references/workos-integrations.md`   |
| Handle WorkOS Events / webhooks | `references/workos-events.md`         |
| Set up Directory Sync           | `references/workos-directory-sync.md` |
| Set up Custom Domains           | `references/workos-custom-domains.md` |
| Set up Audit Logs               | `references/workos-audit-logs.md`     |
| Enable Admin Portal             | `references/workos-admin-portal.md`   |

### API References (Read `references/{name}.md`)

| User wants to...             | Read file                                 |
| ---------------------------- | ----------------------------------------- |
| Admin portal API Reference   | `references/workos-api-admin-portal.md`   |
| Audit logs API Reference     | `references/workos-api-audit-logs.md`     |
| Authkit API Reference        | `references/workos-api-authkit.md`        |
| Directory sync API Reference | `references/workos-api-directory-sync.md` |
| Events API Reference         | `references/workos-api-events.md`         |
| Organization API Reference   | `references/workos-api-organization.md`   |
| Roles API Reference          | `references/workos-api-roles.md`          |
| Sso API Reference            | `references/workos-api-sso.md`            |
| Vault API Reference          | `references/workos-api-vault.md`          |
| Widgets API Reference        | `references/workos-api-widgets.md`        |

### Migrations (Read `references/{name}.md`)

| User wants to...                    | Read file                                             |
| ----------------------------------- | ----------------------------------------------------- |
| Migrate from Supabase Auth          | `references/workos-migrate-supabase-auth.md`          |
| Migrate from Stytch                 | `references/workos-migrate-stytch.md`                 |
| Migrate from the standalone SSO API | `references/workos-migrate-the-standalone-sso-api.md` |
| Migrate from other services         | `references/workos-migrate-other-services.md`         |
| Migrate from Firebase               | `references/workos-migrate-firebase.md`               |
| Migrate from Descope                | `references/workos-migrate-descope.md`                |
| Migrate from Clerk                  | `references/workos-migrate-clerk.md`                  |
| Migrate from Better Auth            | `references/workos-migrate-better-auth.md`            |
| Migrate from AWS Cognito            | `references/workos-migrate-aws-cognito.md`            |
| Migrate from Auth0                  | `references/workos-migrate-auth0.md`                  |

## Routing Decision Tree

Apply these rules in order. First match wins.

### 1. Migration Context

**Triggers**: User mentions migrating FROM another provider (Auth0, Clerk, Cognito, Firebase, Supabase, Stytch, Descope, Better Auth, standalone SSO API).

**Action**: Read `references/workos-migrate-[provider].md` where `[provider]` matches the source system. If provider is not in the table, read `references/workos-migrate-other-services.md`.

**Why this wins**: Migration context overrides feature-specific routing because users need provider-specific data export and transformation steps.

---

### 2. API Reference Request

**Triggers**: User explicitly asks about "API endpoints", "request format", "response schema", "API reference", or mentions inspecting HTTP details.

**Action**: Read `references/workos-api-[feature].md` where `[feature]` matches the domain (admin-portal, audit-logs, authkit, directory-sync, events, organization, roles, sso, vault, widgets).

**Why this wins**: API references are low-level; feature guides are high-level. If user signals low-level intent, skip the feature guide.

---

### 3. Feature-Specific Request

**Triggers**: User mentions a specific WorkOS feature by name (SSO, MFA, Directory Sync, Audit Logs, Vault, RBAC, Admin Portal, Custom Domains, Widgets, Events, Integrations, Email).

**Action**: Read `references/workos-[feature].md` where `[feature]` is the lowercase slug (sso, mfa, directory-sync, audit-logs, vault, rbac, admin-portal, custom-domains, widgets, events, integrations, email).

**Disambiguation**: If user mentions BOTH a feature and "API", route to API reference (#2). If they mention MULTIPLE features, route to the MOST SPECIFIC one first (e.g., "SSO with MFA" → route to SSO; user can request MFA separately).

---

### 4. AuthKit Installation

**Triggers**: User mentions authentication setup, login flow, sign-up, session management, or explicitly says "AuthKit" WITHOUT mentioning a specific feature like SSO or MFA.

**Action**: Detect framework using priority-ordered checks below. Load the corresponding AuthKit skill via the Skill tool.

**Disambiguation**:

- If user says "SSO login via AuthKit", route to `workos-sso` (#3) — feature wins over framework.
- If user says "React login with Google", route to AuthKit React (#4) — this is AuthKit-level auth, not SSO API.
- If user is ALREADY using AuthKit and wants to add a feature (e.g., "add MFA to my AuthKit app"), route to the feature skill (#3), not back to AuthKit installation.

#### Framework Detection Priority (AuthKit only)

Check in this exact order. First match wins:

```
1. `@tanstack/start` in package.json dependencies
   → Load: workos-authkit-tanstack-start

2. `react-router` or `react-router-dom` in package.json dependencies
   → Load: workos-authkit-react-router

3. `next.config.js` OR `next.config.mjs` OR `next.config.ts` exists in project root
   → Load: workos-authkit-nextjs

4. (`vite.config.js` OR `vite.config.ts` exists) AND `react` in package.json dependencies
   → Load: workos-authkit-react

5. NONE of the above detected
   → Load: workos-authkit-vanilla-js
```

**Why this order**: TanStack and React Router are MORE specific than Next.js/Vite+React. A project can have both Next.js AND React Router (e.g., Next.js with RR for client routing); in that case, React Router wins because it's more specific. Vanilla JS is the fallback when no framework is detected.

**Edge case — multiple frameworks detected**: If you detect conflicting signals (e.g., both `next.config.js` and `@tanstack/start`), ASK the user which one they want to use. Do NOT guess.

**Edge case — framework unclear from context**: If the user says "add login" but you cannot scan files (remote repo, no access), ASK: "Which framework are you using? (Next.js, React SPA, React Router, TanStack Start, or vanilla JS)". Do NOT default to vanilla JS without confirmation.

---

### 5. Integration Setup

**Triggers**: User mentions connecting to external IdPs, configuring third-party integrations, or asks "how do I integrate with [provider]".

**Action**: Read `references/workos-integrations.md`.

**Why separate from SSO**: SSO covers the authentication flow; Integrations covers IdP configuration and connection setup. If user mentions BOTH ("set up Google SSO"), route to SSO (#3) — it will reference Integrations where needed.

---

### 6. Vague or General Request

**Triggers**: User says "help with WorkOS", "WorkOS setup", "what can WorkOS do", or provides no feature-specific context.

**Action**:

1. WebFetch https://workos.com/docs/llms.txt
2. Scan the index for the section that best matches the user's likely intent
3. WebFetch the specific section URL
4. Summarize capabilities and ASK the user what they want to accomplish

**Do NOT guess a feature** — force disambiguation by showing options.

---

### 7. No Match / Ambiguous

**Triggers**: None of the above rules match, OR the request is genuinely ambiguous.

**Action**:

1. WebFetch https://workos.com/docs/llms.txt
2. Search the index for keywords from the user's request
3. If you find a match, WebFetch that section URL and proceed
4. If NO match, respond: "I couldn't find a WorkOS feature matching '[user's term]'. Could you clarify? For example: authentication, SSO, MFA, directory sync, audit logs, etc."

---

## Edge Cases

### User mentions multiple features

Route to the MOST SPECIFIC skill first. Example: "SSO with MFA and directory sync" → route to `workos-sso` first. After completing SSO setup, the user can request MFA and Directory Sync separately.

### User mentions a feature + API reference

Route to the API reference (#2). Example: "SSO API endpoints" → `workos-api-sso.md`, not `workos-sso.md`.

### User wants to ADD a feature to an existing AuthKit setup

Route to the feature skill (#3), not back to AuthKit installation. Example: "I'm using AuthKit in Next.js and want to add SSO" → `workos-sso.md`.

### User mentions a provider but no feature

Route to Integrations (#5). Example: "How do I connect Okta?" → `workos-integrations.md`.

### User mentions a provider AND a feature

Route to the feature skill (#3). Example: "Set up Okta SSO" → `workos-sso.md` (it will reference Integrations for Okta setup).

### Unknown framework for AuthKit

If you cannot detect framework and the user hasn't specified, ASK: "Which framework are you using?" Do NOT default to vanilla JS.

### Framework conflicts (multiple frameworks detected)

If detection finds conflicting signals (e.g., both Next.js and TanStack Start configs), ASK: "I see both [framework A] and [framework B]. Which one do you want to use for AuthKit?"

### User provides no context at all

Follow step #6 (Vague or General Request): fetch llms.txt, show options, and force disambiguation.
