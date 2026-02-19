---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Use this skill when migrating user authentication from Firebase Authentication to WorkOS. Handles both password-based users (with bcrypt hash export) and social login accounts, preserving user credentials and login methods during the transition.

## Key Vocabulary

- User Management: password migration via `POST /user_management/users`, bcrypt hash support
- Social connections: Google OAuth, GitHub OAuth migration paths
- Firebase export format: JSON structure from `firebase auth:export`
- Password hash field: `passwordHash` (bcrypt only, other algos require password reset)
- Email verification status: `emailVerified` field mapping
- User identifiers: `localId` (Firebase) → `id` (WorkOS)
- Provider data: `providerUserInfo` array for social logins
- Connection IDs: `conn_` prefix for OAuth providers
- Magic Auth: fallback for non-exportable hash algorithms
- Dashboard: User Management section for bulk operations

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-firebase.guide.md`

## Related Skills

- workos-user-management
- workos-authkit-base
