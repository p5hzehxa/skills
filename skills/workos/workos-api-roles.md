---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this skill when you need to manage fine-grained authorization for organization members. The Roles & Permissions API lets you define what actions users can perform within an organization by creating roles, assigning permissions to those roles, and associating roles with organization members. This is distinct from top-level User Management — it controls what authenticated users can DO, not who can authenticate.

## Documentation

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete

## Key Vocabulary

- **Role** `role_` — a named set of permissions that can be assigned to users across multiple organizations
- **OrganizationRole** `orgrole_` — a role scoped to a specific organization, inherits from a parent Role
- **Permission** `perm_` — an action identifier (e.g., `documents:edit`, `billing:view`) that can be granted or denied
- **Organization** `org_` — the tenant context for scoped roles and member assignments
- **User** `user_` — the entity that receives role assignments within an organization

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-roles.guide.md`

## Related Skills

- workos-api-user-management (for managing organization members who receive role assignments)
