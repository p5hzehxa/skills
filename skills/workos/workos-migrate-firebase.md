---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Use this skill when migrating existing Firebase Authentication users to WorkOS. This covers bulk user import with password hash preservation, incremental migration patterns, and handling Firebase-specific authentication tokens during the transition period.

## Documentation

- https://workos.com/docs/migrate/firebase

## Key Vocabulary

- **User Management API** — the WorkOS API for bulk user imports and password hash operations
- **Authentication token** — Firebase ID tokens used for identity verification during migration
- **Password hash** — scrypt-hashed passwords exported from Firebase Authentication
- **`WORKOS_API_KEY`** — server-side credential for User Management API access
- **`WORKOS_CLIENT_ID`** — application identifier for WorkOS configuration
- **Bulk import** — batch user creation endpoint supporting password hash preservation
- **Incremental migration** — pattern for migrating users gradually during first login
- **Firebase Admin SDK** — required for exporting user data and verifying tokens server-side

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-firebase.guide.md`
