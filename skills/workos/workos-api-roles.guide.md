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

All API calls require your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_your_api_key
```

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organization_roles` | Create a new role |
| GET | `/organization_roles/:id` | Retrieve a specific role |
| GET | `/organization_roles` | List all roles in an organization |
| DELETE | `/organization_roles/:id` | Delete a role |
| POST | `/organization_roles/:id/permissions` | Add a permission to a role |
| DELETE | `/organization_roles/:id/permissions/:permission_id` | Remove a permission from a role |

## Operation Decision Tree

### When to use which endpoint:

**Creating vs Updating Roles:**
- **First time defining a role** → POST `/organization_roles`
- **Adding permissions to existing role** → POST `/organization_roles/:id/permissions`
- **Removing permissions from role** → DELETE `/organization_roles/:id/permissions/:permission_id`
- **Replacing a role entirely** → DELETE old role, then POST new role (no PATCH/PUT endpoint exists)

**Listing vs Getting:**
- **Need one specific role by ID** → GET `/organization_roles/:id`
- **Need all roles in organization** → GET `/organization_roles?organization_id=org_xxx`
- **Searching by role slug** → GET `/organization_roles?organization_id=org_xxx` then filter client-side

**Deleting Roles:**
- Check fetched docs for cascade behavior when deleting roles with active assignments
- Cannot delete roles that are still assigned to users (check docs for exact constraint)

## Core Patterns

### Creating a Role

```bash
curl -X POST https://api.workos.com/organization_roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_xxx",
    "name": "Engineering Manager",
    "slug": "engineering-manager"
  }'
```

**Pattern:**
1. Provide organization_id (where this role exists)
2. Provide name (display label)
3. Provide slug (unique identifier within organization)
4. Check fetched docs for optional fields (description, etc.)

### Adding Permissions to a Role

```bash
curl -X POST https://api.workos.com/organization_roles/role_xxx/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "perm_xxx"
  }'
```

**Pattern:**
1. Use role ID (not slug) in URL path
2. Reference permission by its ID
3. Operation is idempotent (adding same permission twice is safe)

### Listing Roles in an Organization

```bash
curl -X GET "https://api.workos.com/organization_roles?organization_id=org_xxx" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Pagination Pattern:**
- Check fetched docs for pagination parameters (likely `limit` and cursor-based)
- Default page size may be capped (check docs)
- Response includes cursor for next page if more results exist

### Removing a Permission from a Role

```bash
curl -X DELETE https://api.workos.com/organization_roles/role_xxx/permissions/perm_xxx \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Pattern:**
1. Both role_id and permission_id required in URL path
2. Operation is idempotent (removing non-existent permission returns success)

## Error Code Mapping

### 401 Unauthorized
**Cause:** Invalid or missing API key  
**Fix:** Verify `WORKOS_API_KEY` starts with `sk_` and is set correctly

### 404 Not Found
**Causes:**
- Role ID does not exist
- Permission ID does not exist
- Organization ID is invalid

**Fix:** Verify IDs by listing resources first. Role IDs start with `role_`, permission IDs with `perm_`, organization IDs with `org_`

### 409 Conflict
**Causes:**
- Role slug already exists in organization (slugs must be unique per organization)
- Attempting to delete role that has active user assignments

**Fix:** For slug conflicts, choose a different slug or delete existing role. For deletion conflicts, check fetched docs for how to handle role reassignment.

### 422 Unprocessable Entity
**Causes:**
- Missing required fields (organization_id, name, slug)
- Invalid field formats (slug must be lowercase, hyphenated)
- Organization does not exist

**Fix:** Check fetched docs for field validation rules. Slugs typically follow pattern: `[a-z0-9-]+`

### 429 Too Many Requests
**Cause:** Rate limit exceeded  
**Fix:** Implement exponential backoff. Check fetched docs for rate limit values and reset timing.

## Verification Commands

### Verify API Key Setup

```bash
curl -X GET "https://api.workos.com/organization_roles?organization_id=org_xxx&limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with roles array (may be empty)

### Verify Role Creation

```bash
# Create a test role
ROLE_RESPONSE=$(curl -s -X POST https://api.workos.com/organization_roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_xxx",
    "name": "Test Role",
    "slug": "test-role-'$(date +%s)'"
  }')

# Extract role ID from response
ROLE_ID=$(echo $ROLE_RESPONSE | jq -r '.id')

# Verify retrieval
curl -X GET "https://api.workos.com/organization_roles/$ROLE_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with role details matching creation request

### Verify Permission Management

```bash
# Add permission
curl -X POST https://api.workos.com/organization_roles/$ROLE_ID/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"permission_id": "perm_xxx"}'

# Remove permission
curl -X DELETE https://api.workos.com/organization_roles/$ROLE_ID/permissions/perm_xxx \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response for both operations

## Common Traps

### Trap: Using slug instead of ID in API calls
Most endpoints require role ID (`role_xxx`), not slug. Only creation accepts slug as input.

### Trap: Assuming roles are global
Roles are scoped to organizations. Same slug can exist in different organizations.

### Trap: Not handling permission assignment conflicts
Check fetched docs for behavior when adding permission to role that already has it (likely idempotent but verify).

### Trap: Deleting roles without reassigning users
Deleting a role may fail if users still have that role assigned. Check fetched docs for cascade behavior or required cleanup steps.

### Trap: Case-sensitive slug comparison
Slugs are typically stored lowercase. Normalize slugs before comparison or creation.

## Rate Limits

Check fetched docs for current rate limits and quota details. Implement retry logic with exponential backoff:

```
Pseudocode pattern:
max_retries = 3
for attempt in 1..max_retries:
  response = make_api_call()
  if response.status == 429:
    wait_seconds = 2^attempt + random_jitter
    sleep(wait_seconds)
    continue
  break
```

## Related Skills

- workos-user-management (for assigning roles to users)
- workos-organizations (for managing organization context)
- workos-authkit-react (for enforcing role-based access in UI)
