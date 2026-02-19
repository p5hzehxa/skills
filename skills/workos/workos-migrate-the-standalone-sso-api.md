---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Use this skill when you have an existing WorkOS integration using the standalone SSO API and want to migrate to AuthKit. This migration consolidates SSO, MFA, user impersonation, and session management into a single authentication system.

## Documentation

- https://workos.com/docs/migrate/standalone-sso

## Key Vocabulary

- **Connection** `conn_` — SSO connection entity linking your application to an identity provider
- **Organization** `org_` — tenant entity representing a customer using SSO
- **Profile** `profile_` — user identity returned after successful SSO authentication (standalone SSO API)
- **User** `user_` — unified identity entity in AuthKit that replaces Profile
- **Authorization URL** — redirect endpoint for initiating SSO flows (standalone SSO API)
- **Callback endpoint** — route handling SSO responses and exchanging codes for user data

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- `workos-authkit-base` — AuthKit core concepts and authentication flows
- `workos-authkit-nextjs` — Next.js-specific AuthKit integration patterns
- `workos-authkit-react` — React-specific AuthKit integration patterns
