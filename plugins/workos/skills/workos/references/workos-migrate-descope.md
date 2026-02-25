<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## When to Use

Migrate existing users and organizations from Descope to WorkOS when consolidating auth infrastructure or adopting WorkOS's unified platform. This skill covers exporting user data from Descope, transforming it to WorkOS's schema, and importing via the User Management API.

## Key Vocabulary

- **User** `user_` — WorkOS user entity created from Descope user records
- **Organization** `org_` — WorkOS organization entity mapped from Descope tenants
- **Organization Membership** `om_` — links users to organizations after migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-descope.guide.md`

## Related Skills

- **workos-user-management** — user/org operations after migration
- **workos-authkit-base** — integrate authentication post-migration
