---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Migrate existing Auth0 user accounts and organizations to WorkOS while preserving authentication continuity. Use this skill when you need to transfer user identities from Auth0 to WorkOS without forcing password resets or disrupting active sessions.

## Documentation

- https://workos.com/docs/migrate/auth0

## Key Vocabulary

- **User Migration** — transfer user accounts with preserved authentication
- **Organization** — WorkOS entity (`org_`) mapped from Auth0 organizations or tenants
- **Connection** — authentication method (`conn_`) for each migrated organization
- **Password Hash Import** — transfer of Auth0 bcrypt/argon2 hashes to WorkOS
- **Auth0 Management API** — source API for exporting user and org data
- **WORKOS_API_KEY** — server-side authentication credential
- **WORKOS_CLIENT_ID** — application identifier for AuthKit configuration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-auth0.guide.md`

## Related Skills

- workos-authkit-base — post-migration authentication setup
- workos-sso — SSO configuration for migrated organizations
