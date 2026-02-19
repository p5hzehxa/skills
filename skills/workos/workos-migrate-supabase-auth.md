---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## When to Use

Use this when migrating an existing user base from Supabase Auth to WorkOS. This migration preserves user credentials (email/password combinations) so users can continue signing in with their existing passwords after the migration. This is a one-time bulk import operation, not an ongoing sync.

## Documentation

- https://workos.com/docs/migrate/supabase

## Key Concepts

**Migration Approach**
- **Bulk import via API** — WorkOS provides a migration endpoint that accepts batched user data
- **Password hash preservation** — Supabase uses bcrypt; WorkOS accepts bcrypt hashes directly (no re-hashing needed)
- **Email verification state** — transfer `email_confirmed_at` status to WorkOS's `email_verified` boolean
- **User metadata** — map Supabase's `user_metadata` and `app_metadata` to WorkOS profile attributes

**Supabase Export Structure**
- **auth.users table** — primary source of user records with id, email, encrypted_password, email_confirmed_at
- **Password hash format** — Supabase stores bcrypt hashes in `encrypted_password` column (format: `$2a$` or `$2b$` prefix)
- **UUID identifiers** — Supabase user IDs are UUIDs; WorkOS generates new `user_*` prefixed IDs (original IDs can be stored as metadata for reference)
- **Metadata fields** — `raw_user_meta_data` (user-controlled) and `raw_app_meta_data` (application-controlled)

**Migration API Requirements**
- **Endpoint** — POST to WorkOS migration API with user batch payload
- **Authentication** — requires WorkOS API key with migration permissions
- **Batch size** — check fetched docs for recommended batch size limits
- **Rate limits** — check fetched docs for rate limit guidance

**Critical Validation Points**
- **Email uniqueness** — WorkOS requires unique emails; check for duplicates in Supabase export before migration
- **Password hash format** — verify all hashes start with `$2a$` or `$2b$` (bcrypt indicators)
- **Required fields** — email and encrypted_password are mandatory for each user record
- **Email verification mapping** — decide whether to migrate only verified emails or preserve verification state for all users

**Post-Migration Considerations**
- **Authentication cutover** — plan for switching from Supabase Auth SDK to WorkOS AuthKit in your application
- **Session migration** — existing Supabase sessions will be invalidated; users will need to sign in again with WorkOS
- **ID reference mapping** — if your application stores Supabase user IDs in other tables, maintain a mapping between old and new IDs

**Common Decision Points**
- **Partial vs. full migration** — migrate only active/verified users vs. entire user base
- **Metadata selectivity** — which Supabase metadata fields to preserve vs. discard
- **Verification state handling** — auto-verify all migrated emails vs. preserve original verification status
- **Rollback strategy** — keep Supabase Auth operational during testing phase vs. immediate cutover

**Trap Warnings**
- **Don't re-hash passwords** — use the bcrypt hash from Supabase directly; re-hashing will break authentication
- **Don't migrate without email deduplication** — WorkOS will reject duplicate emails, causing batch failures
- **Don't assume metadata schemas match** — Supabase's flexible metadata structure may need flattening for WorkOS profile attributes
- **Don't forget session invalidation notice** — communicate to users that they'll need to sign in again post-migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-supabase-auth.guide.md`
