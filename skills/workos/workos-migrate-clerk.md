---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Use this skill when migrating an existing authentication system from Clerk to WorkOS AuthKit. This guide covers exporting user data from Clerk, transforming it into WorkOS's format, and importing users while preserving their authentication state and organization memberships.

## Documentation

- https://workos.com/docs/migrate/clerk

## Key Vocabulary

- **User ID** — Clerk's user identifier format (starts with `user_`)
- **Organization ID** — Clerk's organization identifier format (starts with `org_`)
- **Organization Membership** — Clerk's join table linking users to organizations with roles
- **Email Address** — primary contact method, may be verified or unverified in Clerk
- **Password Hash** — Clerk uses bcrypt; WorkOS requires bcrypt format during import
- **User Metadata** — custom key-value data stored on Clerk user objects
- **Organization Metadata** — custom key-value data stored on Clerk organization objects
- **Multi-factor Authentication (MFA)** — TOTP or backup codes; requires re-enrollment in WorkOS

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-clerk.guide.md`

## Related Skills

- workos-authkit-base — for understanding WorkOS user and organization models post-migration
- workos-user-management — for managing imported users after migration
