---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## When to Use

Use this skill when migrating authentication from Descope to WorkOS AuthKit. Descope is a CIAM platform, so this migration primarily handles user identity transfer and SSO connection mapping. You'll export user data from Descope's API, transform it to WorkOS format, and import via User Management API.

## Documentation

- https://workos.com/docs/migrate/descope

## Key Vocabulary

- **Organization** `org_` — WorkOS container for users and SSO connections
- **User** `user_` — imported from Descope user records
- **Connection** `conn_` — SSO configuration migrated from Descope projects
- **loginId** — Descope's unique user identifier (maps to WorkOS email)
- **userTenants** — Descope's org membership structure
- **SAML/OIDC connections** — authentication methods to recreate in WorkOS
- **MFA enrollment** — multi-factor settings to preserve during migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-descope.guide.md`
