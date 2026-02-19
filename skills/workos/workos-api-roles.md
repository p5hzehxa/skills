---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this API to define and manage permission systems for multi-tenant applications. Create granular permissions, bundle them into roles, and assign those roles at the organization level. This is the foundation for implementing RBAC (Role-Based Access Control) across your WorkOS-powered application.

## Documentation

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete

## Key Vocabulary

- **Role** `role_` — reusable permission bundles defined at the environment level
- **Permission** `perm_` — atomic access grants (e.g., `documents:read`, `billing:write`)
- **Organization Role** `orgrole_` — role assignments scoped to a specific organization
- **Organization** `org_` — tenant entity that receives role assignments

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-roles.guide.md`

## Related Skills

- workos-user-management (for assigning roles to users)
- workos-organizations (for managing tenant entities)
