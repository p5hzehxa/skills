---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Use this skill when migrating users from a custom authentication system or data store (not a standard provider like Auth0, Cognito, or Firebase). This guide applies when you need to export user data from your own database or a service not covered by other WorkOS migration guides.

## Documentation

- https://workos.com/docs/migrate/other-services

## Key Vocabulary

- **User Management Profile** `user_` — the target identity record in WorkOS
- **Password Hash Import** — bulk import of existing password hashes (bcrypt, scrypt, PBKDF2)
- **Email Verification Status** — whether `email_verified: true` should be set on import
- **User Metadata** — custom JSON fields attached to profiles (e.g., `user_metadata`, `app_metadata`)
- **Migration State** — phased cutover approach (dual-write, read-through, full cutover)
- **CSV Import Format** — structured user data format for bulk import API

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-other-services.guide.md`

## Related Skills

- **workos-user-management** — manage users after migration
- **workos-authkit-base** — implement authentication flows post-migration
