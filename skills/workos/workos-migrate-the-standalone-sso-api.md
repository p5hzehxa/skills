---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Migrate an existing WorkOS standalone SSO API integration to AuthKit. Use this skill when you have a working SSO implementation using WorkOS connection objects and need to transition to the unified AuthKit authentication system while preserving existing SSO connections.

## Documentation

- https://workos.com/docs/migrate/standalone-sso

## Key Vocabulary

- **Connection** `conn_` — SSO provider configuration (SAML, OAuth) linked to an organization
- **Organization** `org_` — tenant entity that owns SSO connections
- **Authorization URL** — standalone SSO API endpoint for initiating login (`/sso/authorize`)
- **Redirect URI** — callback URL after SSO authentication completes
- **Profile object** — user identity payload returned by standalone SSO API
- **AuthKit Sign-In URL** — new unified authentication endpoint replacing standalone authorize
- **Session management** — framework-specific AuthKit SDK responsibility (not `WORKOS_COOKIE_PASSWORD`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- `workos-authkit-nextjs` — if migrating a Next.js application
- `workos-authkit-react` — if migrating a React application
- `workos-directory-sync` — if your SSO integration includes user provisioning
- `workos-organizations` — managing organization entities that own SSO connections
