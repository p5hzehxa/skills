---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Use this skill when migrating users from a custom authentication system or database that doesn't have a dedicated WorkOS migration guide. This covers any user data store (custom auth, internal systems, or unsupported third-party services) where you control the export format.

## Documentation

- https://workos.com/docs/migrate/other-services

## Key Vocabulary

- **User Management API** — WorkOS service for creating and managing user accounts
- **User `user_`** — WorkOS user entity with email, identity, and optional password
- **Organization `org_`** — tenant container for users
- **Email Verification** — `email_verified` boolean flag on user records
- **Password Import** — WorkOS supports bcrypt, Firebase scrypt, and plaintext formats
- **Migration Strategy** — phased cutover, parallel run, or bulk import approach

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-other-services.guide.md`

## Related Skills

- **workos-user-management** — for creating and managing users after migration
- **workos-authkit-base** — for implementing authentication after migration completes
