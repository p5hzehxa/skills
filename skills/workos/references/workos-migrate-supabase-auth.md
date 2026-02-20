<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Migrate existing user authentication from Supabase Auth to WorkOS AuthKit when you need centralized identity management, SSO, or directory sync capabilities. This skill covers both password-based users (with bcrypt hash migration) and OAuth-linked users (email-only migration). Choose this over other migration skills when your source system is specifically Supabase Auth.

## Key Vocabulary

- **User Management User `user_`** — WorkOS entity created for each migrated Supabase user
- **Password Hash `$2a$` or `$2b$`** — bcrypt format exported from Supabase `auth.users.encrypted_password`
- **Migration `migration_`** — WorkOS entity representing a bulk user import operation
- **Email Verification State** — `email_confirmed_at` in Supabase maps to WorkOS email verification status
- **OAuth Identity** — Supabase users with `identities` array (Google, GitHub, etc.) migrate email-only without password

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-supabase-auth.guide.md`

## Related Skills

- **workos-user-management** — target system for migrated users
- **workos-authkit-nextjs** — post-migration authentication integration
