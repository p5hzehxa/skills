<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Migrate existing Auth0 users and organizations to WorkOS when consolidating identity providers or switching to WorkOS AuthKit. This skill covers bulk user import with password hash preservation and organization mapping.

## Key Vocabulary

- **User `user_`** — imported Auth0 user with preserved credentials
- **Organization `org_`** — mapped Auth0 organization or tenant
- **Connection `conn_`** — SSO connection migrated from Auth0
- **Password Hash** — bcrypt format exported from Auth0 (other formats not supported)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-auth0.guide.md`

## Related Skills

- **workos-authkit-base** — core AuthKit authentication patterns
- **workos-api-organization** — organization management after migration
