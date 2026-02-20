<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Migrate existing Firebase Authentication users to WorkOS User Management. Use this skill when you need to preserve user accounts (email, password hashes, metadata) during a platform migration from Firebase to WorkOS.

## Key Vocabulary

- **User Management User** `user_` — WorkOS entity representing a migrated user account
- **Password Import** — WorkOS hash format conversion from Firebase scrypt parameters
- **Firebase scrypt parameters** — `salt_separator`, `signer_key`, `rounds`, `mem_cost` (Firebase-specific hash config)
- **Batch Migration** — importing users via API with preserved authentication credentials

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-firebase.guide.md`
