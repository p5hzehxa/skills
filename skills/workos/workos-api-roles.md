---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## When to Use

Use this API to build role-based access control (RBAC) into multi-tenant B2B applications. Manage roles and permissions at both the environment level (shared across all organizations) and the organization level (scoped to specific customers). Reach for this when you need to control who can perform which actions within your application, either globally or per-tenant.

## Key Concepts

### Structural Vocabulary

**Role Types**
- **Environment Roles** (`/role/*`) — shared templates available to all organizations in your WorkOS environment
- **Organization Roles** (`/organization-role/*`) — customer-specific roles that inherit from or override environment roles

**Core Resources**
- **Permission** — atomic capability (e.g., `documents:read`, `billing:manage`). Identified by a **permission slug** (string you define).
- **Role** — named collection of permissions (e.g., "Admin", "Editor"). Identified by a **role slug** (string you define).
- **Organization** — tenant context. Organization roles are scoped to an `organization_id` (starts with `org_`).

**ID Prefixes**
- `perm_` — Permission ID
- `role_` — Role ID
- `org_` — Organization ID

**Environment Variables**
- `WORKOS_API_KEY` — API key starting with `sk_` (live) or `sk_test_` (test)

### Architectural Patterns

**Environment vs Organization Roles**
- Create environment roles first as templates — these are your baseline RBAC model
- Organizations can then create custom roles or modify inherited ones
- Decision: use environment roles for standard tiers (e.g., "Viewer", "Admin"); use organization roles for customer-specific overrides

**Permission Management**
- Three mutation patterns:
  - `add-permission` — add single permission to existing role
  - `remove-permission` — remove single permission
  - `set-permissions` — replace entire permission set atomically
- Use `set-permissions` when syncing from external state; use `add`/`remove` for incremental updates

**Role Assignment**
- Roles are DEFINED via this API but ASSIGNED via the Directory Sync or User Management APIs
- This API does not handle "which user has which role" — it only defines "what permissions does this role grant"

**Slug Naming Convention**
- Use colon-separated format: `resource:action` (e.g., `documents:read`, `billing:write`)
- Slugs are immutable identifiers — changing a slug requires creating a new permission/role

### Dashboard Navigation

- **Environment Roles**: WorkOS Dashboard → Roles (sidebar)
- **Organization Roles**: WorkOS Dashboard → Organizations → [select org] → Roles tab

### Trap Warnings

- **Slug immutability**: Permission and role slugs cannot be changed after creation — plan your naming scheme carefully
- **Deletion constraints**: Cannot delete a permission that is still assigned to any role — must remove from all roles first
- **Organization scope**: When working with organization roles, always include `organization_id` in requests — omitting it will target environment roles instead

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-roles.guide.md`
