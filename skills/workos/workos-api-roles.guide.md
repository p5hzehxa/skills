<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the latest API docs before proceeding.**

- https://workos.com/docs/reference/roles
- https://workos.com/docs/reference/roles/organization-role
- https://workos.com/docs/reference/roles/organization-role/add-permission
- https://workos.com/docs/reference/roles/organization-role/create
- https://workos.com/docs/reference/roles/organization-role/delete
- https://workos.com/docs/reference/roles/organization-role/get
- https://workos.com/docs/reference/roles/organization-role/list
- https://workos.com/docs/reference/roles/organization-role/remove-permission

## Authentication Setup

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_live_...
```

All requests require the `Authorization: Bearer <api_key>` header. SDKs handle this automatically when you initialize with your API key.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/roles` | Create a new role |
| GET | `/roles/:id` | Retrieve a specific role |
| GET | `/roles` | List all roles for an organization |
| DELETE | `/roles/:id` | Delete a role |
| POST | `/roles/:id/permissions` | Add a permission to a role |
| DELETE | `/roles/:id/permissions/:permission_id` | Remove a permission from a role |

All role operations are scoped to an organization. Supply `organization_id` as a query parameter or in the request body per the fetched docs.

## Operation Decision Tree

**Creating roles:**
- Use `POST /roles` to define a new role with a slug and name
- Assign permissions during creation OR add them afterward with `POST /roles/:id/permissions`

**Updating roles:**
- WorkOS roles are additive — add/remove individual permissions rather than replacing the entire role
- To rename or change slug: check fetched docs for update endpoint availability
- To restructure: delete and recreate (permissions are tied to role ID)

**Listing roles:**
- Use `GET /roles` with `organization_id` query parameter
- Check fetched docs for pagination parameters (likely `before`/`after` cursor-based)

**Deleting roles:**
- Use `DELETE /roles/:id`
- Organization memberships referencing the role will lose that role assignment
- Cannot delete if role is the last admin role — check error response for this scenario

**Managing permissions:**
- Add: `POST /roles/:id/permissions` with `permission_id` in body
- Remove: `DELETE /roles/:id/permissions/:permission_id`
- Permissions are scoped to resources — define resources first in Dashboard or via Resources API

## Common Patterns

### Creating a role with permissions

```pseudocode
# Step 1: Create the role
role = create_role(
  organization_id: "org_123",
  slug: "editor",
  name: "Editor"
)

# Step 2: Add permissions
for permission_id in required_permissions:
  add_permission_to_role(
    role_id: role.id,
    permission_id: permission_id
  )
```

### Checking if a user has a specific permission

Roles assign permissions, but you check authorization via the User Management API. Cross-reference with `workos-api-user-management` for authorization checks.

### Listing roles for an organization

```bash
curl "https://api.workos.com/roles?organization_id=org_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Check fetched docs for `limit`, `before`, `after` pagination params.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Invalid `organization_id` or `slug` format | Verify `organization_id` starts with `org_` and slug is alphanumeric with underscores/hyphens only |
| 401 | Missing or invalid API key | Check `WORKOS_API_KEY` starts with `sk_` and has Roles permission enabled in Dashboard |
| 404 | Role or permission not found | Verify role ID exists and permission ID is defined for the organization |
| 409 | Duplicate role slug | Role slugs must be unique per organization — choose a different slug or update existing role |
| 422 | Invalid permission assignment | Permission may not be compatible with role type — check fetched docs for permission scope rules |

Check fetched docs for complete error response schema including `code` and `message` fields.

## Pagination Handling

WorkOS list endpoints use cursor-based pagination. Pattern:

```pseudocode
roles = []
cursor = null

loop:
  response = list_roles(
    organization_id: "org_123",
    after: cursor,
    limit: 100  # check fetched docs for max
  )
  roles.extend(response.data)
  
  if not response.list_metadata.after:
    break
  cursor = response.list_metadata.after
```

Check fetched docs for exact pagination metadata field names.

## Rate Limiting

WorkOS enforces rate limits per API key. If you receive `429 Too Many Requests`:

- Implement exponential backoff with jitter
- Start with 1s delay, double on each retry, cap at 60s
- Check `Retry-After` header if present

For high-volume operations (bulk permission assignments), batch requests and add delays between batches.

## Verification Commands

**Test API key:**
```bash
curl https://api.workos.com/roles?organization_id=org_YOUR_ORG_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with `data` array (may be empty).

**Create a test role:**
```bash
curl -X POST https://api.workos.com/roles \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_YOUR_ORG_ID",
    "slug": "test_role",
    "name": "Test Role"
  }'
```

Expected: 201 response with role object including `id`, `slug`, `name`.

**Verify role exists:**
```bash
curl https://api.workos.com/roles/role_RETURNED_ID \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with role object.

## Integration Traps

**Trap: Assuming roles auto-assign to users**
Roles must be explicitly assigned to organization memberships via the User Management API. Creating a role does NOT automatically grant it to anyone.

**Trap: Treating slug as mutable**
Role slugs are typically immutable identifiers. To "rename" a role, delete and recreate it — this will break existing membership assignments. Check fetched docs for update capabilities.

**Trap: Deleting roles without checking dependencies**
If a role is assigned to users, deleting it removes their permissions immediately. Fetch memberships with that role first, reassign them, then delete.

**Trap: Permissions without resources**
Permissions are meaningless without resources. Define resources in the Dashboard (Projects, Documents, etc.) before assigning permissions. Resources are organization-scoped.

**Trap: Confusing Roles API with RBAC product feature**
This API manages role definitions. To check "does user X have permission Y", use the Authorization API (check `workos-api-authorization` for permission checking patterns).

## Related Skills

- `workos-api-user-management` — Assign roles to organization memberships
- `workos-api-authorization` — Check user permissions at runtime
- `workos-api-organizations` — Manage organizations that scope roles
