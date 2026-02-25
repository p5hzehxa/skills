<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this API when you need to define custom authorization models with fine-grained permissions. Roles group permissions into reusable sets; permissions define atomic actions (e.g., "read:documents"). This is for building RBAC systems where you control who can do what, not for managing user authentication.

## Key Vocabulary

- **Role `role_`** — reusable permission set scoped to environment or organization
- **Permission `perm_`** — atomic action definition (namespace:resource pattern)
- **Organization Role `org_role_`** — role instance scoped to a specific organization

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-roles.guide.md`

## Related Skills

- workos-authkit-nextjs — check user roles after authentication
- workos-authkit-react — enforce permission-based UI logic
