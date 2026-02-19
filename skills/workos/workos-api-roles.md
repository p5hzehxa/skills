---
name: workos-api-roles
description: WorkOS RBAC API endpoints — roles, permissions, and role assignments.
---

<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete
- https://workos.com/docs/reference/roles/organization-role/get
- https://workos.com/docs/reference/roles/organization-role/list
- https://workos.com/docs/reference/roles/organization-role/remove-permission

## Endpoint Catalog

### Global Roles (Environment-Wide Templates)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/roles` | Create a global role template |
| GET | `/roles/:id` | Fetch a specific global role |
| GET | `/roles` | List all global role templates |
| PATCH | `/roles/:id` | Update a global role template |
| POST | `/roles/:id/permissions` | Add permission to global role |
| POST | `/roles/:id/permissions/set` | Replace all permissions on global role |

### Organization Roles (Org-Specific Instances)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organization_roles` | Create org-specific role |
| GET | `/organization_roles/:id` | Fetch a specific org role |
| GET | `/organization_roles` | List org roles (filter by org) |
| PATCH | `/organization_roles/:id` | Update org role |
| DELETE | `/organization_roles/:id` | Delete org role |
| POST | `/organization_roles/:id/permissions` | Add permission to org role |
| DELETE | `/organization_roles/:id/permissions/:permission_id` | Remove permission from org role |
| POST | `/organization_roles/:id/permissions/set` | Replace all permissions on org role |

### Permissions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/permissions` | Create a permission |
| GET | `/permissions/:id` | Fetch a specific permission |
| GET | `/permissions` | List all permissions |
| PATCH | `/permissions/:id` | Update permission metadata |
| DELETE | `/permissions/:id` | Delete a permission |

## Authentication Setup

Include your API key in the `Authorization` header:

```bash
Authorization: Bearer sk_live_...
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_live_...
```

## Operation Decision Tree

### When to use Global Roles vs Organization Roles

```
Are you defining a role template that applies across all orgs?
├─ YES → Use /roles (global role)
│   └─ Example: "Admin", "Member", "Billing Manager"
└─ NO → Use /organization_roles (org-specific role)
    └─ Example: Custom roles that vary per org
```

### Create vs Update vs Set Permissions

```
Do you need to manage role permissions?
├─ Adding ONE permission → POST /roles/:id/permissions or /organization_roles/:id/permissions
├─ Removing ONE permission → DELETE /organization_roles/:id/permissions/:permission_id
└─ Replacing ALL permissions → POST /roles/:id/permissions/set or /organization_roles/:id/permissions/set
```

**Trap:** There is no DELETE endpoint for global role permissions. To remove a permission from a global role, use the set-permissions endpoint with the desired permission list.

### List Filtering Pattern

When listing organization roles:
- Filter by `organization_id` query parameter
- Filter by `role_slug` to find roles derived from a global template
- Paginate with `before`, `after`, `limit` parameters

Check fetched docs for exact pagination parameter names and formats.

## Error Code Mapping

| Status Code | Common Cause | Fix |
|-------------|--------------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active |
| 404 | Role or permission not found | Verify the ID exists with a GET request first |
| 409 | Duplicate slug | Role slugs must be unique within an environment — choose a different slug |
| 422 | Invalid request payload | Check fetched docs for required fields and format constraints |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay, double on each retry) |

## Pagination Handling

The list endpoints return paginated results. Check fetched docs for the exact pagination parameters, but the pattern is:

1. Initial request returns `data` array + `list_metadata` with `before` and `after` cursors
2. To fetch next page, include `after` cursor from previous response
3. To fetch previous page, include `before` cursor from previous response
4. Set `limit` to control page size (default and max vary by endpoint)

Pseudocode:
```
all_roles = []
cursor = null

loop:
  response = GET /organization_roles?organization_id=X&after=cursor&limit=100
  all_roles.append(response.data)
  
  if response.list_metadata.after exists:
    cursor = response.list_metadata.after
  else:
    break

return all_roles
```

## Verification Commands

### Test Authentication
```bash
curl https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 with role list (may be empty)

### Create and Verify Global Role
```bash
# Create
curl -X POST https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "test-role",
    "name": "Test Role"
  }'

# Verify (save role ID from create response)
curl https://api.workos.com/roles/role_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Create Organization Role from Global Template
```bash
curl -X POST https://api.workos.com/organization_roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_123",
    "role_slug": "test-role"
  }'
```

Expected: 201 with new organization role inheriting permissions from global template

## Rate Limits

WorkOS applies rate limits per API key. If you receive 429 responses:

1. Parse `Retry-After` header (seconds until retry)
2. Implement exponential backoff if no header present
3. Consider batching operations (use set-permissions instead of multiple add-permission calls)

## Common Patterns

### Initialize Default Roles for New Organization

```
1. Fetch global role templates: GET /roles
2. For each desired role (e.g., "admin", "member"):
   POST /organization_roles with organization_id + role_slug
3. Permissions are inherited from global template
```

### Customize Permissions for Specific Org

```
1. Create org role from template (inherits permissions)
2. Modify permissions:
   - Add: POST /organization_roles/:id/permissions
   - Remove: DELETE /organization_roles/:id/permissions/:permission_id
   - Replace all: POST /organization_roles/:id/permissions/set
```

### Audit Role Hierarchy

```
1. List global roles: GET /roles
2. For each org:
   GET /organization_roles?organization_id=X
3. Compare org role permissions against global template
4. Identify customizations by checking role_slug matches
```

## Related Skills

- workos-user-management (assigning roles to users)
- workos-organizations (managing organization lifecycle)
