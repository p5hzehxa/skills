<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference — Implementation Guide

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

The docs above contain request schemas, response formats, query parameters, and error codes. Fetch them first.

## Authentication Setup

All Directory Sync API requests require a WorkOS API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

Retrieve your API key from the WorkOS Dashboard under API Keys. Keys starting with `sk_test_` are for testing, `sk_live_` for production.

## Endpoint Catalog

Directory Sync provides these REST endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directories` | List all directories for your organization |
| GET | `/directories/{directory_id}` | Get a single directory by ID |
| DELETE | `/directories/{directory_id}` | Delete a directory |
| GET | `/directory_users` | List users from one or more directories |
| GET | `/directory_users/{directory_user_id}` | Get a single directory user by ID |
| GET | `/directory_groups` | List groups from one or more directories |
| GET | `/directory_groups/{directory_group_id}` | Get a single directory group by ID |

All IDs follow these prefixes:
- Directories: `directory_`
- Users: `directory_user_`
- Groups: `directory_group_`

## Operation Decision Tree

**To read user/group data:**
1. If you know the exact user/group ID → use GET `/directory_users/{id}` or GET `/directory_groups/{id}`
2. If you need to search or list users/groups → use GET `/directory_users` or GET `/directory_groups` with query params
3. If you need data from a specific directory → add `?directory={directory_id}` to list endpoints

**To find which directory to query:**
1. If you have an organization ID → use GET `/directories?organization={org_id}`
2. If you need all directories → use GET `/directories` without filters
3. Directory IDs are stable — cache them per organization to reduce API calls

**Common patterns:**
- Fetch directory ID once per org, then query users/groups by `directory` param
- Use `limit` and pagination for large result sets (see Pagination Handling below)
- Poll directory endpoints periodically OR use webhooks for real-time sync (see Related Skills)

## Pagination Handling

List endpoints (`/directory_users`, `/directory_groups`, `/directories`) support cursor-based pagination:

1. First request: GET `/directory_users?limit=100`
2. Response includes `list_metadata.after` if more results exist
3. Next request: GET `/directory_users?limit=100&after={cursor_value}`
4. Repeat until `list_metadata.after` is null

Pseudocode pattern:
```
cursor = null
all_users = []

loop:
  response = fetch("/directory_users?limit=100" + (cursor ? "&after=" + cursor : ""))
  all_users.append(response.data)
  cursor = response.list_metadata.after
  if cursor is null: break

return all_users
```

Check fetched docs for `list_metadata` schema and default limit values.

## Error Code Mapping

Directory Sync API returns standard HTTP status codes. Common errors:

| Status | Cause | Fix |
|--------|-------|-----|
| 401 Unauthorized | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is present and key is valid |
| 404 Not Found | Directory/user/group ID doesn't exist | Confirm ID prefix matches resource type. IDs are immutable — if deleted, they won't return |
| 422 Unprocessable Entity | Invalid query parameter (e.g., malformed `directory` param) | Check parameter names and formats in fetched docs. Common: wrong ID prefix or typo in param name |
| 429 Too Many Requests | Rate limit exceeded | Implement exponential backoff. Start with 1s delay, double on each retry, max 32s |
| 500 Internal Server Error | Transient WorkOS issue | Retry with exponential backoff. If persistent, check WorkOS status page |

The API does NOT return custom error codes — rely on HTTP status + response body `message` field for details.

## Rate Limit Guidance

WorkOS enforces rate limits per API key. Limits are NOT published in docs — they scale with your plan tier.

**Retry strategy:**
1. On 429 response, check `Retry-After` header (seconds to wait)
2. If no header, use exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s
3. After 5 retries, fail and log for manual review

**Prevention:**
- Cache directory IDs and metadata — they change infrequently
- Batch user/group queries with `limit` param instead of individual GET requests
- Use webhooks for real-time updates instead of polling (see `workos-directory-sync` feature skill)

## Runnable Verification

Test your Directory Sync integration with these curl commands:

**1. List all directories:**
```bash
curl -X GET "https://api.workos.com/directories" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with `data` array of directory objects. If 401, check API key format.

**2. List users from a specific directory:**
```bash
# Replace directory_01H123ABC with your directory ID from step 1
curl -X GET "https://api.workos.com/directory_users?directory=directory_01H123ABC&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with `data` array of user objects. Check `list_metadata.after` for pagination cursor.

**3. Get a single user by ID:**
```bash
# Replace with a directory_user_* ID from step 2
curl -X GET "https://api.workos.com/directory_users/directory_user_01H456DEF" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with single user object. If 404, verify the user ID exists in your directory.

## SDK Usage Pattern

If using the WorkOS SDK instead of REST API directly:

**Node.js pseudocode:**
```javascript
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// List directories
const directories = await workos.directorySync.listDirectories();

// List users from a directory
const users = await workos.directorySync.listUsers({
  directory: 'directory_01H123ABC',
  limit: 100
});

// Get single user
const user = await workos.directorySync.getUser('directory_user_01H456DEF');
```

Check fetched docs for exact method signatures in your SDK language (Python, Ruby, Go, etc.).

## Common Agent Traps

**Trap 1: Confusing directory IDs with organization IDs**
- Directories belong to organizations, but they're NOT the same ID
- Use GET `/directories?organization={org_id}` to find directory IDs for an org

**Trap 2: Polling too aggressively**
- Directory data changes slowly (minutes/hours, not seconds)
- Poll every 5-15 minutes OR use webhooks — NOT every request

**Trap 3: Not handling pagination**
- Large directories can have 10k+ users
- Always check `list_metadata.after` and loop until null

**Trap 4: Caching stale directory IDs**
- If a directory is deleted, its ID becomes permanently invalid (404)
- Refresh directory list if you get 404 on a cached ID

**Trap 5: Assuming user emails are unique**
- Directory providers may allow duplicate emails across groups
- Use `directory_user_id` as the unique identifier, NOT email

## Related Skills

- `workos-directory-sync` — Feature overview and webhook handling for real-time directory updates
- `workos-user-management` — Provisioning and managing users in WorkOS User Management via Directory Sync
