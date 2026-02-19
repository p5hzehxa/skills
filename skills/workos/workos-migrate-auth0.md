---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Migrate existing user accounts and organization data from Auth0 to WorkOS AuthKit, preserving user credentials so they can continue signing in with their existing passwords. This skill covers both password hash import and passwordless migration strategies depending on Auth0 plan capabilities.

## Documentation

- https://workos.com/docs/migrate/auth0

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Auth0 user records
- **Organization `org_`** — WorkOS organization entity mapped from Auth0 organizations or tenant structures
- **Password hash** — bcrypt hash exported from Auth0 (Enterprise plan only)
- **Magic Auth** — passwordless authentication fallback when hash export unavailable
- **Auth0 Management API** — source API for exporting user and organization data
- **`email_verified`** — user verification status field to preserve during migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-auth0.guide.md`

## Related Skills

- workos-authkit-base
- workos-authkit-nextjs
- workos-authkit-react
