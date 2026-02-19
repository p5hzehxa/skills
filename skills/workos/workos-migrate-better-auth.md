---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Use this when migrating an existing Better Auth implementation to WorkOS AuthKit. Better Auth provides database-based authentication with sessions, users, and organizations — this guide helps preserve user accounts, organization structures, and session continuity during the transition. Ideal for applications moving from a self-hosted auth solution to WorkOS's managed platform.

## Documentation

- https://workos.com/docs/migrate/better-auth

## Key Concepts

### Migration Scope
- **User Migration** — preserving Better Auth user accounts with their email/password credentials in WorkOS
- **Organization Migration** — mapping Better Auth organizations (if used) to WorkOS organizations
- **Session Continuity** — maintaining active user sessions through the migration

### Better Auth Data Model
- **Users Table** — stores user credentials, emails, and metadata
- **Sessions Table** — tracks active authentication sessions
- **Organizations Table** — groups users into tenants (if multi-tenant architecture)
- **Better Auth Database Schema** — varies by project; export user/org data before migration

### WorkOS Equivalents
- **WorkOS Users** — identified by `user_*` prefix
- **WorkOS Organizations** — identified by `org_*` prefix
- **Email/Password Authentication** — WorkOS supports password-based auth for migrated users

### Migration Pattern
1. Export Better Auth users and organizations from your database
2. Create WorkOS organizations (if migrating multi-tenant structure)
3. Import users via WorkOS User Management API, assigning them to organizations
4. Update authentication flow to use WorkOS AuthKit
5. Handle session cutover — existing Better Auth sessions can remain valid during transition or be invalidated based on security requirements

### Decision Points
- **Password Handling** — Better Auth stores hashed passwords; WorkOS requires users to reset passwords on first login UNLESS you export hashes in a compatible format (check fetched docs for supported hash algorithms)
- **Session Strategy** — decide whether to invalidate all Better Auth sessions immediately or allow gradual transition
- **Organization Mapping** — if Better Auth uses custom org structures, map them to WorkOS's organization model (1:1 or consolidated)

### Traps
- **Password Hash Compatibility** — not all Better Auth hash formats are supported by WorkOS; verify hash algorithm compatibility before migration (if incompatible, force password reset flow)
- **Session Table Cleanup** — Better Auth sessions won't automatically invalidate; implement cleanup logic or set expiration policies
- **Email Verification State** — check if Better Auth tracks email verification separately; WorkOS requires explicit `emailVerified` flag on user creation

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-better-auth.guide.md`
