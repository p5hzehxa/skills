---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

You have an existing WorkOS integration using the standalone SSO API (`client.sso.*` methods) and need to migrate to AuthKit. This guide covers the code changes, session management differences, and deployment considerations for moving from SSO API authentication flows to AuthKit's session-based model.

## Key Vocabulary

- **Connection** `conn_` — SSO connection entity (carries over unchanged from standalone SSO API to AuthKit)
- **Organization** `org_` — organization entity (carries over unchanged)
- **User** `user_` — WorkOS user entity (new in AuthKit; replaces standalone SSO API's transient user objects)
- **Profile** — user attributes returned by standalone SSO API (replaced by AuthKit session `user` object)
- **AuthKit session** — browser session managed by AuthKit (replaces custom session handling in standalone SSO API)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- `workos-authkit-nextjs` — if migrating a Next.js app
- `workos-authkit-react` — if migrating a React SPA
- `workos-authkit-vanilla-js` — if migrating a vanilla JS app
