<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Migrate existing user accounts and organizational structures from Better Auth to WorkOS when you need enterprise SSO, Directory Sync, or advanced authentication features. This skill handles user identity transfer, password hash migration (if supported by Better Auth's export format), and organizational hierarchy mapping.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Better Auth user records
- **Organization `org_`** — WorkOS organization entity mapped from Better Auth organization/tenant structures
- **Organization Membership `om_`** — User-to-organization association transferred from Better Auth membership records

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-better-auth.guide.md`

## Related Skills

- `workos-api-organization` — Configuring organization settings post-migration
- `workos-authkit-nextjs` — Implementing authentication UI after migration
