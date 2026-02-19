---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Use this skill when migrating user authentication from a custom-built identity system or a provider not covered by WorkOS's provider-specific guides. This covers scenarios where you control the user data store and export format, but need guidance on password handling, field mapping, and cutover strategy for generic migration scenarios.

## Key Vocabulary

- **User Management API** — the WorkOS API for bulk user creation and provisioning
- **Environment `environment_`** — WorkOS tenant isolation boundary (prod, staging, dev)
- **Organization `org_`** — the target entity for imported users
- **Password migration strategies** — reset-on-first-login vs hash import vs JIT migration patterns
- **User Import API** — batch endpoint for creating users with custom attributes
- **`WORKOS_API_KEY`** — server-side credential for User Management API calls
- **Identity linking** — mapping external user IDs to WorkOS user IDs during migration
- **Staged rollout** — phased cutover approach (shadow mode → partial traffic → full cutover)

## Documentation

- https://workos.com/docs/migrate/other-services

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-other-services.guide.md`
