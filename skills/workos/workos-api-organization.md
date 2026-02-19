---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## When to Use

Use this skill when you need to create, retrieve, update, or delete organization records in WorkOS. Organizations are tenant containers that group users and resources — essential for B2B multi-tenant applications. Reach for this skill when building admin dashboards, onboarding flows, or tenant provisioning systems.

## Documentation

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id
- https://workos.com/docs/reference/organization/list
- https://workos.com/docs/reference/organization/update

## Key Vocabulary

- **Organization** `org_` — tenant container grouping users and resources
- **Domain** `domain_` — verified domain associated with an organization
- **`external_id`** — your system's unique identifier for the organization
- **`allow_profiles_outside_organization`** — boolean controlling cross-organization user access

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-organization.guide.md`

## Related Skills

- workos-user-management (for managing users within organizations)
- workos-sso (for configuring SSO connections per organization)
- workos-directory-sync (for syncing directory data to organizations)
