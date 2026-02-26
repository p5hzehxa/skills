<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Use this skill when migrating an existing Clerk-based authentication system to WorkOS AuthKit. This covers moving user accounts, organization structures, and SSO connections while maintaining user access during the transition.

## Key Vocabulary

- **User `user_`** — WorkOS user entity mapped from Clerk user data
- **Organization `org_`** — WorkOS organization entity mapped from Clerk organizations
- **Organization Membership `om_`** — user-to-organization association
- **Connection `conn_`** — SSO connection configuration migrated from Clerk
- **Directory `directory_`** — directory sync configuration for SCIM provisioning

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-clerk.guide.md`

## Related Skills

- **workos-authkit-nextjs** — integrate AuthKit after migration
- **workos-authkit-react** — integrate AuthKit in React apps
- **workos-api-organization** — manage migrated organizations
- **workos-sso** — configure SSO connections
- **workos-directory-sync** — set up directory sync
