<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Migrate existing users from Supabase Auth to WorkOS while preserving their ability to sign in with existing passwords. Use this when you need to transition an application from Supabase's authentication system to WorkOS without forcing users to reset passwords or re-authenticate.

## Key Vocabulary

- **User Migration `user_migration_`** — the WorkOS resource that imports user records with password hashes
- **bcrypt hash format** — Supabase uses bcrypt for password storage; WorkOS accepts bcrypt hashes during migration
- **User Management** — the WorkOS feature that stores migrated user identities after import

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-supabase-auth.guide.md`

## Related Skills

- **workos-user-management** — target system for migrated users
- **workos-authkit-react** — post-migration authentication UI
- **workos-authkit-nextjs** — post-migration authentication for Next.js apps
