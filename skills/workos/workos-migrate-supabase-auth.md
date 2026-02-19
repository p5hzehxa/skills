---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Use this skill when migrating an existing user base from Supabase Auth to WorkOS User Management. This handles user identity transfer, including encrypted password hashes and metadata, while maintaining authentication continuity for your users.

## Documentation

- https://workos.com/docs/migrate/supabase

## Key Vocabulary

- User Management environment `env_`
- Organization `org_`
- User `user_`
- Password hash `$2a$` (bcrypt format from Supabase)
- `WORKOS_API_KEY` environment variable
- Migration API endpoint for bulk imports
- Supabase `auth.users` table structure
- Email verification status mapping
- User metadata field mapping

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-supabase-auth.guide.md`
