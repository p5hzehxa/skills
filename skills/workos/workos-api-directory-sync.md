---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/directory-sync
- https://workos.com/docs/reference/directory-sync/directory
- https://workos.com/docs/reference/directory-sync/directory-group
- https://workos.com/docs/reference/directory-sync/directory-group/get
- https://workos.com/docs/reference/directory-sync/directory-group/list
- https://workos.com/docs/reference/directory-sync/directory-user
- https://workos.com/docs/reference/directory-sync/directory-user/get
- https://workos.com/docs/reference/directory-sync/directory-user/list

## Endpoint Catalog

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/directories` | List all directories for an organization |
| GET | `/directories/{id}` | Retrieve a specific directory |
| DELETE | `/directories/{id}` | Remove a directory connection |
| GET | `/directory_users` | List users from directory providers |
| GET | `/directory_users/{id}` | Retrieve a specific directory user |
| GET | `/directory_groups` | List groups from directory providers |
| GET | `/directory_groups/{id}` | Retrieve a specific directory group |

## Authentication Setup

All API requests require Bearer token authentication with your WorkOS API key.

**Header format:**
```
Authorization: Bearer sk_live_...
```

**Environment variable:**
```bash
export WORKOS_API_KEY="sk_live_..."
```

**Verification command:**
```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 response with directory list or empty array.

## Operation Decision Tree

### Listing Resources

**Use case: Fetch all users from a directory**
→ GET `/directory_users?directory={directory_id}`

**Use case: Fetch all groups from a directory**
→ GET `/directory_groups?directory={directory_id}`

**Use case: Find which directories exist for an organization**
→ GET `/directories?organization={organization_id}`

### Retrieving Single Resources

**Use case: Get user details by ID**
→ GET `/directory_users/{user_id}`

**Use case: Get group details by ID**
→ GET `/directory_groups/{group_id}`

**Use case: Get directory metadata**
→ GET `/directories/{directory_id}`

### Filtering and Search

**By organization:**
Add `?organization={org_id}` to list endpoints

**By directory:**
Add `?directory={directory_id}` to user/group list endpoints

**By group membership:**
Add `?group={group_id}` to user list endpoint

Check fetched docs for complete filter parameter list.

## ID Prefixes

Recognize resources by ID prefix:
- `directory_`: Directory resource
- `directory_user_`: Directory user resource
- `directory_group_`: Directory group resource
- `org_`: Organization resource

## Pagination Pattern

All list endpoints return paginated results.

**Request pattern:**
```
GET /directory_users?limit=50&after={cursor}
```

**Response structure (check fetched docs for exact schema):**
```
{
  "data": [...],
  "list_metadata": {
    "after": "cursor_string",
    "before": "cursor_string"
  }
}
```

**Iteration pseudocode:**
```
cursor = null
all_users = []

loop:
  response = fetch("/directory_users?directory={id}&after={cursor}")
  all_users.append(response.data)
  cursor = response.list_metadata.after
  if cursor is null: break
```

## Error Code Mapping

| Status | Cause | Fix |
| ------ | ----- | --- |
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is set correctly |
| 403 | API key lacks required permissions | Check key environment (test vs live) matches directory environment |
| 404 | Resource not found | Verify ID format and that resource exists in correct environment |
| 422 | Invalid parameter value | Check fetched docs for valid parameter formats |
| 429 | Rate limit exceeded | Implement exponential backoff (see Rate Limits below) |
| 500 | WorkOS service error | Retry with exponential backoff, contact support if persistent |

**Specific errors:**

**"Directory not found"** → Check directory ID and verify it belongs to the correct organization

**"Organization required"** → Add `?organization={org_id}` filter parameter

**"Invalid directory state"** → Directory may be pending activation or deleted — check status in Dashboard

## Rate Limits

Directory Sync API has rate limits (check fetched docs for current values).

**Retry strategy:**
```
initial_delay = 1 second
max_retries = 3

for attempt in 1..max_retries:
  response = make_request()
  if response.status != 429: return response
  sleep(initial_delay * (2 ^ attempt))
  
throw "Rate limit exceeded after retries"
```

**Trap:** Do not retry 4xx errors other than 429 — they indicate client errors that won't resolve with retries.

## Webhook Events

Directory Sync emits webhook events for real-time updates. Use webhooks instead of polling for changes.

**Event types:**
- `dsync.user.created`
- `dsync.user.updated`
- `dsync.user.deleted`
- `dsync.group.created`
- `dsync.group.updated`
- `dsync.group.deleted`

**Integration pattern:**
1. Register webhook endpoint in WorkOS Dashboard
2. Verify webhook signatures (see webhooks skill)
3. Handle events idempotently — events may be delivered multiple times
4. Return 200 immediately, process asynchronously

Check fetched docs for event payload schemas.

## Common Patterns

### Sync All Users from a Directory

**Pattern:**
```
1. GET /directories?organization={org_id}
2. For each directory:
   - GET /directory_users?directory={dir_id} (paginate through all)
   - Store users locally
3. Set up webhooks for incremental updates
```

**Trap:** Do not poll list endpoints frequently — use webhooks for updates to avoid rate limits.

### Find User's Group Memberships

**Pattern:**
```
1. GET /directory_users/{user_id}
2. Extract group IDs from user.groups array
3. For detailed group data:
   - GET /directory_groups/{group_id} for each group
```

**Optimization:** Cache group details — they change less frequently than memberships.

### Check If Directory Is Active

**Pattern:**
```
1. GET /directories/{directory_id}
2. Check directory.state field
```

**States to handle (check fetched docs for complete list):**
- `linked`: Active and syncing
- `unlinked`: Not connected
- `invalid_credentials`: Auth failure — user must reconnect

## Verification Commands

**Test API key:**
```bash
curl https://api.workos.com/directories \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Test directory access:**
```bash
curl https://api.workos.com/directories/{directory_id} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Test user listing:**
```bash
curl "https://api.workos.com/directory_users?directory={directory_id}&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Test pagination:**
```bash
curl "https://api.workos.com/directory_users?directory={directory_id}&limit=1&after={cursor}" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

## SDK Usage Pattern

**Initialize client:**
```
client = WorkOS(api_key=WORKOS_API_KEY)
```

**List users:**
```
response = client.directory_sync.list_users(
  directory=directory_id,
  limit=50,
  after=cursor
)
```

**Get single user:**
```
user = client.directory_sync.get_user(user_id)
```

Check fetched docs for SDK method signatures in your language.

## Traps and Gotchas

**Trap:** Directory IDs are not the same as connection IDs. Use the correct ID type for each endpoint.

**Trap:** User emails are not guaranteed unique across directories — always scope queries by directory.

**Trap:** Deleted users remain in API responses with `state: "inactive"` — filter by state if you only want active users.

**Trap:** Group hierarchies are flattened — parent-child relationships are not preserved in the API.

**Trap:** Custom attributes vary by provider (Azure AD vs Okta vs Google) — do not assume consistent attribute names. Check fetched docs for provider-specific schemas.

## Related Skills

- workos-directory-sync (feature implementation guide)
- workos-webhooks (for handling directory sync events)
