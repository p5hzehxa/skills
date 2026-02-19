<!-- refined:sha256:7daeec70196c -->

# WorkOS Roles & Permissions API Reference — Implementation Guide

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

## Authentication Setup

Authenticate API calls using your WorkOS API key in the `Authorization` header:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY='sk_your_api_key'
```

API keys starting with `sk_test_` are test mode keys. Production keys start with `sk_live_`.

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations/{org_id}/roles` | Create a new role |
| GET | `/organizations/{org_id}/roles/{role_id}` | Retrieve a specific role |
| GET | `/organizations/{org_id}/roles` | List all roles in an organization |
| DELETE | `/organizations/{org_id}/roles/{role_id}` | Delete a role |
| POST | `/organizations/{org_id}/roles/{role_id}/permissions` | Add a permission to a role |
| DELETE | `/organizations/{org_id}/roles/{role_id}/permissions/{permission_id}` | Remove a permission from a role |

Check fetched docs for complete request/response schemas and parameter requirements.

## Operation Decision Tree

### Creating vs Managing Roles

**When to create a new role:**
- You need a custom permission set that doesn't exist
- You're setting up organization-specific access patterns
- You're implementing a multi-tenant hierarchy

**When to modify existing roles:**
- Adding/removing permissions from established roles
- Adjusting access levels for existing user groups
- Responding to policy changes

**When to delete roles:**
- Role is no longer used by any organization members
- Consolidating duplicate or redundant roles
- Removing test/development roles from production

### Permission Management Pattern

Use `add-permission` when:
- Granting additional access to an existing role
- Implementing incremental permission grants
- Adding new capabilities to established roles

Use `remove-permission` when:
- Revoking specific access without deleting the role
- Implementing least-privilege adjustments
- Handling security incidents or policy violations

## Common Integration Patterns

### Pattern 1: Role Provisioning Flow

```pseudocode
1. Create organization (if new tenant)
2. Define role with base permissions:
   POST /organizations/{org_id}/roles
   body: { name: "...", slug: "...", description: "..." }
3. Add permissions incrementally:
   POST /organizations/{org_id}/roles/{role_id}/permissions
   body: { permission: "resource.action" }
4. Assign role to users via User Management API
```

### Pattern 2: Dynamic Permission Updates

```pseudocode
1. List current roles to find target:
   GET /organizations/{org_id}/roles
2. Check current permissions in response
3. Add new permission:
   POST /organizations/{org_id}/roles/{role_id}/permissions
4. Verify update:
   GET /organizations/{org_id}/roles/{role_id}
```

### Pattern 3: Role Cleanup

```pseudocode
1. Verify role has no active assignments (check User Management API)
2. Remove all permissions:
   DELETE /organizations/{org_id}/roles/{role_id}/permissions/{permission_id}
   (repeat for each permission)
3. Delete role:
   DELETE /organizations/{org_id}/roles/{role_id}
```

## Pagination Handling

When listing roles, the API returns paginated results. Check fetched docs for:
- Default page size limits
- Cursor or offset parameters
- Response structure with pagination metadata

Standard pattern:
```pseudocode
roles = []
cursor = null
do {
  response = GET /organizations/{org_id}/roles?after={cursor}
  roles.append(response.data)
  cursor = response.list_metadata.after
} while (cursor != null)
```

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header is set correctly |
| 403 | API key lacks required scope | Check key permissions in WorkOS Dashboard under API Keys |
| 404 | Organization ID or Role ID not found | Verify ID format (`org_...` or `role_...`) and existence |
| 409 | Role slug already exists in organization | Choose a different slug or update existing role |
| 422 | Invalid request parameters | Check fetched docs for required fields and valid formats |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s, double on each retry) |
| 500/502/503 | WorkOS service error | Retry with exponential backoff (max 3 attempts) |

### Common Parameter Errors (422)

- **Missing required field**: Check fetched docs for required fields in request body
- **Invalid slug format**: Role slugs must be lowercase alphanumeric with hyphens/underscores
- **Invalid permission format**: Permissions follow `resource.action` pattern (e.g., `documents.read`)
- **Invalid organization ID**: Must start with `org_` prefix

## Rate Limits

WorkOS APIs have rate limits. Check fetched docs for current limits. General guidance:

- Implement exponential backoff for 429 responses
- Start with 1 second delay, double on each retry
- Max 5 retry attempts before failing
- Cache role data when possible to reduce API calls

## Runnable Verification

### Verify Authentication

```bash
curl -X GET "https://api.workos.com/organizations/{org_id}/roles" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with JSON array of roles (may be empty)

### Create a Test Role

```bash
curl -X POST "https://api.workos.com/organizations/{org_id}/roles" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Role",
    "slug": "test-role",
    "description": "Integration test role"
  }'
```

Expected: 201 Created with role object containing `id` starting with `role_`

### Add Permission to Role

```bash
curl -X POST "https://api.workos.com/organizations/{org_id}/roles/{role_id}/permissions" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "permission": "documents.read"
  }'
```

Expected: 201 Created (check fetched docs for exact response structure)

### Retrieve Role with Permissions

```bash
curl -X GET "https://api.workos.com/organizations/{org_id}/roles/{role_id}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with role object including permissions array

## SDK Usage Pattern

If using the WorkOS SDK (recommended over direct REST calls):

```pseudocode
# Initialize client
workos = WorkOS(api_key=WORKOS_API_KEY)

# Create role
role = workos.organizations.create_role(
  organization_id="org_...",
  name="Role Name",
  slug="role-slug",
  description="Description"
)

# Add permission
workos.organizations.add_role_permission(
  organization_id="org_...",
  role_id=role.id,
  permission="resource.action"
)

# List roles
roles = workos.organizations.list_roles(
  organization_id="org_..."
)

# Get specific role
role = workos.organizations.get_role(
  organization_id="org_...",
  role_id="role_..."
)

# Remove permission
workos.organizations.remove_role_permission(
  organization_id="org_...",
  role_id="role_...",
  permission_id="permission_..."
)

# Delete role
workos.organizations.delete_role(
  organization_id="org_...",
  role_id="role_..."
)
```

Check fetched docs for exact SDK method signatures in your language.

## Common Traps

### Trap 1: Deleting Roles with Active Assignments
**Problem**: Attempting to delete a role that's still assigned to users
**Fix**: Check User Management API for role assignments before deletion, reassign users first

### Trap 2: Duplicate Role Slugs
**Problem**: Creating roles with slugs that already exist in the organization
**Fix**: List existing roles first, or handle 409 conflict by updating existing role

### Trap 3: Invalid Permission Format
**Problem**: Using incorrect permission string format
**Fix**: Follow `resource.action` pattern (e.g., `documents.read`, not `read_documents`)

### Trap 4: Missing Organization Context
**Problem**: Forgetting that roles are organization-scoped
**Fix**: Always include organization ID in role operations; same slug can exist in different orgs

### Trap 5: Permission ID Confusion
**Problem**: Using permission string instead of permission ID when removing
**Fix**: When removing permissions, use the permission ID from the role object, not the permission string

## Verification Checklist

- [ ] API key is set in environment as `WORKOS_API_KEY`
- [ ] API key starts with `sk_test_` (test) or `sk_live_` (production)
- [ ] Can successfully list roles for a test organization
- [ ] Can create a role with valid slug format
- [ ] Can add and remove permissions from roles
- [ ] Error responses (401, 404, 422) are handled with specific messages
- [ ] Rate limit handling (429) includes exponential backoff
- [ ] Organization IDs start with `org_` prefix
- [ ] Role IDs start with `role_` prefix

## Related Skills

This skill covers the Roles & Permissions API. For implementing role-based access control in your application UI and enforcing permissions, see the User Management and Authorization features in the WorkOS documentation.
