---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## When to Use

Use this skill when migrating existing user identities and organization structures from Descope to WorkOS. This migration preserves user authentication states, organization hierarchies, and role assignments while transitioning to WorkOS's User Management API.

## Documentation

- https://workos.com/docs/migrate/descope

## Key Vocabulary

- **User** (`user_`) — user identity record in WorkOS User Management
- **Organization** (`org_`) — tenant/workspace entity in WorkOS
- **Organization Membership** (`om_`) — links users to organizations with role assignments
- **Email Verification** — user email verification state (verified/unverified)
- **Password Hash** — encrypted password credentials migrated from source system
- **Role** — user permission level within an organization (e.g., `member`, `admin`)
- **WORKOS_API_KEY** — server-side authentication token for WorkOS API calls
- **Migration Flow** — phased process: organizations → users → memberships → verification

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-descope.guide.md`

## Related Skills

- **workos-user-management** — target system APIs for creating users and managing organizations
- **workos-authkit-nextjs** — post-migration authentication setup for Next.js applications
