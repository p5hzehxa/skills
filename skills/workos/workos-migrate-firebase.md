---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Migrate existing Firebase Authentication users to WorkOS User Management while preserving their credentials. Use this skill when transitioning from Firebase's auth system to WorkOS without forcing users to reset passwords.

## Documentation

- https://workos.com/docs/migrate/firebase

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from migrated Firebase users
- **Organization `org_`** — WorkOS organization entity for grouping migrated users
- **Password hash algorithms** — `scrypt`, `standard_scrypt`, `bcrypt`, `md5`, `sha1`, `sha256`, `sha512`, `hmac_sha1`, `hmac_sha256`, `hmac_sha512`, `pbkdf_sha1`, `pbkdf2_sha256`
- **Firebase Admin SDK** — required for exporting user data from Firebase
- **`passwordHash`** — base64-encoded password hash field from Firebase export
- **`passwordSalt`** — base64-encoded salt field from Firebase export
- **`hash_config`** — Firebase project-level hash configuration object

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-firebase.guide.md`

## Related Skills

- workos-user-management-core — for post-migration user operations
- workos-authkit-base — for implementing authentication after migration
