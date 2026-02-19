---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Use this skill when migrating from Stytch's authentication system to WorkOS AuthKit. Covers user data export from Stytch, password hash migration, organization mapping, and session transition strategies.

## Key Vocabulary

- **User Entity** — Stytch user record with `user_id`, email, and password hash
- **Organization `org_`** — WorkOS organization entity mapped from Stytch organizations
- **Member `om_`** — WorkOS organization member linking users to organizations
- **Password Hash Format** — Stytch uses bcrypt/scrypt; WorkOS requires bcrypt migration format
- **Session Token** — Stytch session tokens must be invalidated during migration
- **MFA Settings** — Stytch MFA configurations (TOTP, SMS) and their WorkOS equivalents
- **OAuth Connections** — Stytch OAuth providers mapped to WorkOS SSO connections
- **Magic Link Migration** — Stytch passwordless users transition to WorkOS email verification
- **Stytch Project ID** — source system identifier for audit trails

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-stytch.guide.md`

## Related Skills

- workos-authkit-base — AuthKit setup after migration
- workos-user-management — managing migrated users in WorkOS
