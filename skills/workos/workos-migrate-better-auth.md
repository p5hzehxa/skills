---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Migrate existing Better Auth users and organizations to WorkOS AuthKit while preserving user identities, passwords, and organizational structures. Use this skill when you need to transition from Better Auth's database-backed authentication to WorkOS's managed authentication platform.

## Documentation

- https://workos.com/docs/migrate/better-auth

## Key Vocabulary

- **User Profile `user_`** — WorkOS user entity created from Better Auth user records
- **Organization `org_`** — WorkOS organization entity mapped from Better Auth organization data
- **Organization Membership `om_`** — links users to organizations with role assignments
- **Password Hash Migration** — bcrypt/argon2 hash transfer from Better Auth database
- **Email Verification Status** — preserved `emailVerified` state during migration
- **Session Migration** — Better Auth session tokens do not transfer; users must re-authenticate

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-better-auth.guide.md`

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
