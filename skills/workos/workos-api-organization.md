---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## When to Use

Use this skill when you need to create, read, update, or delete organization records in WorkOS. Organizations are tenant containers that group users and enable features like SSO, Directory Sync, and Admin Portal. This is the foundational API for multi-tenant B2B applications.

## Key Vocabulary

- **Organization** — Tenant entity with ID prefix `org_`
- **`external_id`** — Your system's unique identifier for the organization (optional)
- **`name`** — Display name for the organization
- **`domains`** — Email domains associated with the organization (array)
- **`allow_profiles_outside_organization`** — Boolean flag controlling user membership rules
- **List endpoint pagination** — Uses `before`, `after`, `limit` parameters
- **Get by external ID** — Alternative lookup method using your system's identifier

## Documentation

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-organization.guide.md`
