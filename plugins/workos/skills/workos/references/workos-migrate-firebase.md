<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Use this skill when migrating an existing user base from Firebase Authentication to WorkOS User Management. This skill covers extracting user data from Firebase, transforming it into WorkOS-compatible format, and importing users while preserving authentication capabilities where possible.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Firebase user records
- **Password Hash Migration** — Firebase uses scrypt; WorkOS supports bcrypt import (rehashing required on first login)
- **Profile Migration** — Firebase custom claims and metadata map to WorkOS user profile fields
- **Email Verification Status** — Firebase `emailVerified` flag maps to WorkOS email verification state
- **Provider Linkage** — Firebase federated identity providers (Google, GitHub, etc.) must be reconnected in WorkOS

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-firebase.guide.md`

## Related Skills

- **workos-user-management** — target system for migrated users
- **workos-authkit-base** — authentication setup after migration completes
