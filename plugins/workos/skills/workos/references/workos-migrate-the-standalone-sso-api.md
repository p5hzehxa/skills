<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Use this skill when you have an existing WorkOS integration using the standalone SSO API (`sso.getAuthorizationUrl()`, `sso.getProfileAndToken()`) and want to migrate to AuthKit for better security, simpler session management, and built-in UI components. This migration applies to production workloads where you need to preserve existing SSO connections and user sessions without downtime.

## Key Vocabulary

- **Organization** `org_` — entity that manages SSO connections
- **Connection** `conn_` — SSO provider link (SAML, Google OAuth, Microsoft OAuth)
- **Profile** — user identity returned after authentication
- **Session** — authenticated state managed by AuthKit (replaces manual token handling)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- `workos-authkit-nextjs` — if migrating a Next.js app to AuthKit
- `workos-authkit-react` — if migrating a React SPA to AuthKit
- `workos-authkit-base` — core AuthKit concepts and session management
