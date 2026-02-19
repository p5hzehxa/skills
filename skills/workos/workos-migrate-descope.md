---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## When to Use

Migrate users and organizations from Descope to WorkOS when consolidating identity providers or moving to WorkOS's unified authentication platform. This skill covers mapping Descope's project structure (projects → tenants) to WorkOS organizations and importing user identities without password hashes.

## Key Vocabulary

- **Organization** (`org_`) — WorkOS entity that maps to a Descope project or tenant
- **User** (`user_`) — WorkOS entity representing an imported Descope user identity
- **Connection** (`conn_`) — authentication method linking organizations to identity providers
- **Authentication Factor** — mapped from Descope's MFA settings (TOTP, SMS, email)
- **Descope Management API** — source API for exporting project/tenant/user data
- **Project** — Descope's top-level container (maps to WorkOS organization)
- **Tenant** — Descope's multi-tenant isolation unit (also maps to WorkOS organization)
- `WORKOS_API_KEY` — authentication credential for WorkOS API calls
- `userManagement.createUser()` — SDK method for importing user records

## Documentation

- https://workos.com/docs/migrate/descope

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-descope.guide.md`
