<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this API to define and manage fine-grained permissions across your application. Roles and permissions can be scoped globally (account-wide) or per-organization, enabling multi-tenant RBAC without rebuilding authorization logic for each tenant.

## Key Vocabulary

- **Role `role_`** — reusable permission container (e.g., "Admin", "Viewer")
- **Permission `perm_`** — atomic action grant (e.g., "billing:read")
- **OrganizationRole `orgrole_`** — tenant-specific role instance with custom permissions
- **Resource** — dot-separated scope identifier (e.g., `billing`, `users.profile`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-roles.guide.md`
