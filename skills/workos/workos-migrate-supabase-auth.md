---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Migrate existing user authentication from Supabase Auth to WorkOS when you need enterprise SSO, Directory Sync, or advanced auth features while preserving user credentials. Use this skill when you have users with email/password or social login in Supabase and need to transition them to WorkOS without forcing password resets.

## Documentation

- https://workos.com/docs/migrate/supabase

## Key Vocabulary

- **User** — Supabase Auth user record exported via SQL or Management API
- **Password Hash** — bcrypt hash extracted from Supabase `auth.users.encrypted_password`
- **Identity** — Supabase social login connection (e.g., Google, GitHub)
- **User Management API** — WorkOS endpoint for importing users with `POST /user_management/users`
- **Organization** `org_` — WorkOS container for migrated users
- **Password** `password_` — WorkOS entity storing imported bcrypt hashes
- **Email Verification** — Supabase `confirmed_at` field maps to WorkOS `email_verified` boolean
- **User Metadata** — Supabase `raw_user_meta_data` maps to WorkOS custom user attributes

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-supabase-auth.guide.md`
