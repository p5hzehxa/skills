---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Migrate existing users from Supabase Auth to WorkOS User Management while preserving authentication credentials. Use this skill when you need to transfer user accounts, email/password hashes, and metadata from Supabase to WorkOS without forcing password resets.

## Documentation

- https://workos.com/docs/migrate/supabase

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Supabase user data
- **Authentication Factor `auth_factor_`** — WorkOS entity storing migrated password hash
- **Organization `org_`** — WorkOS organization entity for multi-tenant migrations
- **`bcrypt` hash format** — Supabase's password hashing algorithm, supported by WorkOS
- **`email_verified` flag** — Supabase user verification status to preserve during migration
- **`user_metadata`** — Supabase custom user data to map to WorkOS user attributes
- **`app_metadata`** — Supabase application-level metadata for role/permission mapping

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-supabase-auth.guide.md`

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
