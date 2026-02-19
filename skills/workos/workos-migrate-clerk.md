---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Migrate existing users and organizations from Clerk to WorkOS AuthKit when you need to preserve user identities, authentication state, and organizational structures. This skill covers data export from Clerk, transformation into WorkOS formats, and import strategies that minimize user friction during the transition.

## Key Vocabulary

- **Organization** (`org_`) — WorkOS entity representing a company/team
- **User** (`user_`) — WorkOS entity representing an individual account
- **Connection** (`conn_`) — SSO configuration linking an organization to an identity provider
- **Environment** (`environment_`) — WorkOS deployment environment (staging/production)
- **Clerk User ID** — source system identifier to preserve in migration metadata
- **Clerk Organization ID** — source system organization identifier
- **`WORKOS_API_KEY`** — server-side authentication credential
- **`WORKOS_CLIENT_ID`** — application identifier for AuthKit
- **User Management API** — WorkOS endpoint for creating/updating users
- **Organizations API** — WorkOS endpoint for creating/updating organizations

## Documentation

- https://workos.com/docs/migrate/clerk

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-clerk.guide.md`

## Related Skills

- workos-authkit-base
- workos-authkit-nextjs
- workos-authkit-react
