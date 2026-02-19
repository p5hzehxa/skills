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

These docs contain current request/response schemas, authentication requirements, and behavioral constraints.

## Authentication Setup

All Roles API calls require:
- **API Key header**: `Authorization: Bearer <WORKOS_API_KEY>`
- Key format: starts with `sk_` prefix
- Set key as environment variable `WORKOS_API_KEY`

Verify authentication works:
```bash
curl https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with role list or empty array. 401 = invalid key.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/roles` | List all organization roles |
| POST | `/roles` | Create a new role |
| GET | `/roles/{role_id}` | Get role details by ID |
| DELETE | `/roles/{role_id}` | Delete a role |
| POST | `/roles/{role_id}/permissions` | Add permission to role |
| DELETE | `/roles/{role_id}/permissions/{permission_id}` | Remove permission from role |

All endpoints return JSON. Check fetched docs for exact request/response schemas.

## Operation Decision Tree

**Creating roles:**
- Use `POST /roles` for new roles
- Include `name` and `slug` (slug = unique identifier for programmatic access)
- Organization context determined by API key scope

**Updating role permissions:**
- Use `POST /roles/{role_id}/permissions` to add permissions
- Use `DELETE /roles/{role_id}/permissions/{permission_id}` to remove permissions
- No bulk update endpoint — apply changes iteratively

**When to fetch vs list:**
- Use `GET /roles/{role_id}` when you have the role ID
- Use `GET /roles` to discover available roles or filter by organization
- List endpoint supports pagination (see Pagination section)

**Deletion constraints:**
- Check fetched docs for whether roles with active assignments can be deleted
- Consider orphaned permission references when deleting roles

## Pagination Handling

The `GET /roles` endpoint supports pagination. Check fetched docs for:
- Pagination parameter names (`limit`, `after`, `before`)
- Default and maximum page sizes
- Cursor format for next/previous pages

Pattern for iterating all roles:
```
1. Call GET /roles with limit parameter
2. Store returned roles
3. If response includes next_cursor, call GET /roles?after={cursor}
4. Repeat until no next_cursor returned
```

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 404 | Role ID not found | Confirm role exists with `GET /roles` — may have been deleted |
| 409 | Slug conflict (role creation) | Choose a unique slug — slugs are organization-scoped identifiers |
| 422 | Invalid request payload | Check fetched docs for required fields and format constraints |
| 429 | Rate limit exceeded | Implement exponential backoff — see Rate Limits section |

Check fetched docs for complete error response schema and additional error codes.

## Rate Limit Guidance

WorkOS APIs enforce rate limits per API key. Check fetched docs for:
- Requests per second/minute thresholds
- Rate limit headers (`X-RateLimit-Remaining`, `Retry-After`)

Retry strategy:
```
1. On 429 response, read Retry-After header
2. Wait specified seconds (or 60s if header absent)
3. Retry request with exponential backoff (2x, 4x, 8x)
4. After 3 retries, fail with clear error message
```

## Runnable Verification

**Test role creation:**
```bash
curl -X POST https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Role","slug":"test-role"}'
```

Expected: 201 response with created role object containing `id`, `name`, `slug`.

**Test role listing:**
```bash
curl https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with `data` array containing roles.

**Test permission assignment:**
```bash
# Replace {role_id} and {permission_id} with actual IDs
curl -X POST https://api.workos.com/roles/{role_id}/permissions \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"permission_id":"{permission_id}"}'
```

Expected: 200 response confirming permission added.

## Common Integration Patterns

**Creating roles at organization provisioning:**
```
1. Create organization via Organizations API
2. Define default roles (e.g., admin, member, viewer)
3. Call POST /roles for each default role with organization context
4. Store role IDs for later permission assignments
```

**Role-based access control (RBAC) enforcement:**
```
1. User authenticates via AuthKit
2. Retrieve user's organization memberships
3. Call GET /roles to fetch organization's roles
4. Match user's assigned role(s) to permission sets
5. Gate application features based on permissions
```

**Syncing roles from external system:**
```
1. Fetch roles from source system
2. Call GET /roles to get current WorkOS roles
3. Create missing roles with POST /roles
4. Update permissions via add/remove endpoints
5. Delete roles no longer in source (handle constraints)
```

## Troubleshooting

**"Role slug already exists" on creation:**
- Slugs must be unique within organization scope
- Call `GET /roles` to list existing slugs
- Choose a different slug or update the existing role

**Permissions not appearing after assignment:**
- Verify permission was added with `GET /roles/{role_id}`
- Check that permission ID exists in your organization's permission set
- Confirm permission assignment returned 200 (not 422)

**Role deletion fails:**
- Check if role is assigned to users (fetched docs specify constraints)
- Remove user assignments before deleting role
- Verify you have permission to delete roles in Dashboard

## Related Skills

- **workos-user-management** — Assigning roles to users and organization members
- **workos-organizations** — Managing organization context for role scoping
