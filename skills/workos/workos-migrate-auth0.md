---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Use this skill when migrating existing users and organizations from Auth0 to WorkOS AuthKit. This migration preserves user identities, passwords, and organizational structures while transitioning authentication infrastructure. Choose this over other migration skills when your current identity provider is Auth0.

## Key Vocabulary

- **User ID format** — Auth0's `user_id` vs WorkOS `user_id`
- **Password hashing** — Auth0's bcrypt exports vs WorkOS requirements
- **Organization structure** — Auth0 Organizations mapped to WorkOS Organizations `org_`
- **Connection types** — Auth0 Database Connections vs WorkOS Connections `conn_`
- **Management API** — Auth0's token-based API for bulk exports
- **User metadata** — `user_metadata` and `app_metadata` field mappings
- **MFA enrollment** — Auth0 MFA factors and WorkOS MFA methods
- **Email verification status** — `email_verified` flag migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-auth0.guide.md`

## Related Skills

- workos-authkit-base — Post-migration authentication setup
- workos-authkit-nextjs — Implementing AuthKit after migration
- workos-authkit-react — Client-side authentication patterns
