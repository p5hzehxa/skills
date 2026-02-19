---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this API when you need programmatic control over authorization models — creating roles, assigning permissions, and managing organization-specific role overrides. Reach for this when building admin panels, custom permission UIs, or automation that modifies authorization structures. If you only need to check existing permissions, use the User Management API's `user.getOrganizationMembership()` instead.

## Key Vocabulary

- **Role** `role_` — account-level template defining a set of permissions
- **Organization Role** `org_role_` — organization-specific role instance, can override permissions
- **Permission** `perm_` — granular capability string (e.g., `documents:read`)
- **Organization** `org_` — tenant context for role assignments
- **User** `user_` — identity receiving role assignments via memberships
- **Membership** `mem_` — links user to organization with assigned role
- `/roles` — root endpoint for account-level role templates
- `/organization-role` — endpoint family for org-specific role overrides

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-roles.guide.md`

## Related Skills

- `workos-api-user-management` — for checking permissions via memberships
- `workos-api-organizations` — for managing the org entities roles apply to
