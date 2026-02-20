<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Migrate existing Auth0 users and organizations to WorkOS when consolidating auth providers or adopting WorkOS AuthKit. Handles password hash imports, organization structures, and SSO connection mappings.

## Key Vocabulary

- **User `user_`** — imported Auth0 user with password hash
- **Organization `org_`** — mapped Auth0 tenant or organization
- **Connection `conn_`** — migrated SSO connection from Auth0 Enterprise
- **Password Hash Algorithm** — Auth0-specific formats (bcrypt, PBKDF2)
- **Migration `mig_`** — bulk import job tracking entity

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-auth0.guide.md`

## Related Skills

- **workos-authkit-base** — post-migration authentication flows
- **workos-directory-sync** — if migrating Auth0 SCIM directories
- **workos-user-management** — managing imported users after migration
