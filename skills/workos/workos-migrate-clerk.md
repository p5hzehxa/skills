---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Use this skill when migrating an existing authentication system from Clerk to WorkOS AuthKit. This guide covers user and organization data transfer, including password hash migration and organization membership mapping. Choose this over other migration skills when your source system is specifically Clerk.

## Documentation

- https://workos.com/docs/migrate/clerk

## Key Vocabulary

- **User** — identity entity with email, name, and authentication credentials
- **Organization `org_`** — workspace or tenant entity in WorkOS
- **Organization Membership** — relationship linking users to organizations with roles
- **Password Hash** — bcrypt-hashed credential exported from Clerk
- **SCIM Directory Sync** — automated user provisioning system (alternative to manual migration)
- **Clerk User ID** — source system identifier to preserve in `externalId`
- **AuthKit** — WorkOS authentication UI and session management system

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-clerk.guide.md`

## Related Skills

- workos-authkit-base
- workos-authkit-react
- workos-authkit-nextjs
