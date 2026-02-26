<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Use this skill when migrating from WorkOS's standalone SSO API to AuthKit. This is relevant if your app currently calls `sso.getAuthorizationUrl()` or `sso.getProfileAndToken()` for authentication and you want to adopt WorkOS's newer session-based authentication system with built-in UI components.

## Key Vocabulary

- **Standalone SSO API** — the older WorkOS authentication system using explicit authorization URL construction and token exchange
- **AuthKit** — the newer WorkOS authentication system with hosted UI and session management
- **Connection `conn_`** — SSO configuration entity (unchanged between systems)
- **Organization `org_`** — tenant entity (unchanged between systems)
- **User `user_`** — authenticated user entity (structure differs between systems)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- `workos-authkit-nextjs` — if migrating to Next.js
- `workos-authkit-react` — if migrating to React SPA
- `workos-authkit-vanilla-js` — if migrating to vanilla JavaScript
