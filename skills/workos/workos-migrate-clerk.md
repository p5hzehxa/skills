---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Use this when migrating an existing Clerk-based authentication system to WorkOS. This migration involves transferring user accounts, organization structures, and authentication flows while maintaining user access and minimizing disruption. Choose this path when you need to preserve existing user identities and organizational hierarchies from Clerk.

## Documentation

- https://workos.com/docs/migrate/clerk

## Key Concepts

### Migration Architecture
- **Two-phase approach**: Export from Clerk → Import to WorkOS (no direct API bridge exists)
- **Organization mapping**: Clerk organizations map to WorkOS organizations (1:1 relationship)
- **User identity preservation**: Email addresses serve as the primary identity anchor across systems
- **Password migration limitation**: Clerk does not export password hashes — users must reset passwords or use passwordless auth post-migration

### Clerk-Specific Concepts
- **Clerk Organization ID**: Retrieved from Clerk dashboard under "Organization settings"
- **Clerk User ID**: Source system identifier used during export phase
- **Clerk Sessions**: Must be invalidated before cutover to prevent dual-session state
- **Clerk Webhooks**: Disable before cutover to avoid event conflicts during transition

### WorkOS Target Concepts
- **Organization**: Target entity created via `POST /organizations` — requires `name` field
- **Organization ID**: Prefixed with `org_` (e.g., `org_01H7ZK...`) — store mapping from Clerk org ID
- **User Management API**: Target system for imported users — uses `POST /user_management/users`
- **Email verification state**: Users imported without passwords start in "unverified" state until they complete passwordless flow
- **AuthKit**: Target authentication system — replaces Clerk's frontend components and session management

### Migration-Specific IDs and Mapping
- **Mapping table structure**: `clerk_org_id → workos_org_id`, `clerk_user_id → workos_user_id`
- **Idempotency**: Store WorkOS IDs immediately after creation to support retry logic
- **Org ID prefix**: WorkOS organization IDs always start with `org_`
- **User ID prefix**: WorkOS user IDs always start with `user_`

### Decision Points
- **Password strategy**: Choose between forced password reset (via email) vs. passwordless-only migration
- **Cutover timing**: All-at-once (maintenance window) vs. gradual (dual-write period)
- **Role migration**: Map Clerk roles to WorkOS role slugs — check fetched docs for WorkOS role requirements
- **Session handling**: Decide whether to force logout all users at cutover or allow graceful session expiry

### Common Traps
- **Do NOT attempt live sync**: Clerk and WorkOS have no shared session protocol — cutover must be atomic
- **Do NOT assume password portability**: Clerk does not provide password hash exports in any format
- **Verify Clerk export completeness**: Ensure all organizations and memberships are included before cutover
- **Test mapping logic**: Dry-run imports to staging environment to catch ID mapping errors

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-clerk.guide.md`
