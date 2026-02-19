---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## When to Use

Use this skill when you need to manage organization entities in WorkOS—creating tenants for B2B customers, mapping external CRM IDs to WorkOS organizations, or querying organization metadata. Organizations are the top-level container for SSO connections, Directory Sync configurations, and user memberships. Reach for this skill when building multi-tenant onboarding flows or syncing customer data from external systems.

## Documentation

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id

## Key Vocabulary

- **Organization** `org_` — top-level tenant entity containing SSO connections and Directory Sync configurations
- **`externalId`** — customer-defined identifier for mapping to external systems (CRM, billing)
- **`domains`** — list of verified email domains associated with the organization
- **`allowProfilesOutsideOrganization`** — boolean controlling whether users can authenticate without organization membership

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-organization.guide.md`

## Related Skills

- workos-user-management — for managing users within organizations
- workos-sso — for configuring SSO connections scoped to organizations
- workos-directory-sync — for syncing SCIM directories to organizations
