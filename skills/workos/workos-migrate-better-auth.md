---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Migrate existing users and organizations from Better Auth to WorkOS AuthKit while preserving user accounts, authentication methods, and organizational structures. Use this when transitioning from Better Auth's self-hosted authentication system to WorkOS's managed authentication platform.

## Key Vocabulary

- **User `user_`** — WorkOS user entity migrated from Better Auth accounts
- **Organization `org_`** — WorkOS organization entity mapped from Better Auth organizations
- **Organization Membership `org_membership_`** — user-to-organization associations
- **Password Hash Migration** — transferring bcrypt-hashed passwords from Better Auth
- **Email Verification State** — preserving `emailVerified` status from Better Auth
- **Multi-Factor Authentication (MFA)** — migrating TOTP configurations
- **Session Continuity** — maintaining active sessions during migration
- **OAuth Provider Mappings** — converting Better Auth social connections to WorkOS connections

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-better-auth.guide.md`

## Related Skills

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
