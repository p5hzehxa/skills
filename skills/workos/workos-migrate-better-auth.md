---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Use this skill when migrating an existing Better Auth installation to WorkOS AuthKit. This covers migrating user accounts, password hashes, organization structures, and OAuth connections while preserving user authentication flows.

## Documentation

- https://workos.com/docs/migrate/better-auth

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Better Auth user records
- **Organization `org_`** — WorkOS organization entity mapped from Better Auth account structures
- **Organization Membership `org_membership_`** — user-to-organization association
- **Password hash** — bcrypt hashes exported from Better Auth and imported to WorkOS
- **OAuth Connection `conn_`** — social login provider linkage (Google, GitHub, etc.)
- **`WORKOS_API_KEY`** — server-side API authentication credential
- **`WORKOS_CLIENT_ID`** — public application identifier for AuthKit

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-better-auth.guide.md`
