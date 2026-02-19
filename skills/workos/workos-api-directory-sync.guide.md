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

_Check fetched docs for request/response schemas, required fields, and error codes._

## Authentication Setup

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY=sk_test_your_key_here
```

All API calls require the `Authorization: Bearer {WORKOS_API_KEY}` header.

Verify authentication works:

```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directories` | List all directories in your environment |
| GET | `/directories/{directory_id}` | Get a specific directory |
| DELETE | `/directories/{directory_id}` | Delete a directory |
| GET | `/directory_users` | List users across directories |
| GET | `/directory_users/{user_id}` | Get a specific user |
| GET | `/directory_groups` | List groups across directories |
| GET | `/directory_groups/{group_id}` | Get a specific group |

_Check fetched docs for complete endpoint list and parameters._

## Operation Decision Tree

### Listing Resources

**To list all users in a specific directory:**
- Use `GET /directory_users?directory={directory_id}`
- Apply pagination if result set is large

**To list all groups in a specific directory:**
- Use `GET /directory_groups?directory={directory_id}`
- Apply pagination if result set is large

**To list all directories for an organization:**
- Use `GET /directories?organization={organization_id}`

### Retrieving Individual Resources

**To get a single user:**
- Use `GET /directory_users/{user_id}` if you have the user ID
- Use `GET /directory_users?directory={directory_id}&limit=1` with filters if searching

**To get a single group:**
- Use `GET /directory_groups/{group_id}` if you have the group ID
- Use `GET /directory_groups?directory={directory_id}&limit=1` with filters if searching

### Handling Deletions

**When a directory is deleted:**
- Use `DELETE /directories/{directory_id}`
- This removes the directory and all associated users/groups
- Handle `dsync.deleted` webhook events to clean up local data

## Pagination Pattern

All list endpoints support cursor-based pagination:

```
GET /directory_users?directory={directory_id}&limit=50&after={cursor}
```

Response includes:
- `data[]` — current page of results
- `list_metadata.after` — cursor for next page (null if last page)

Pseudocode for paginating through all users:

```
cursor = null
all_users = []

loop:
  response = fetch("/directory_users?directory={id}&after={cursor}")
  all_users.append(response.data)
  cursor = response.list_metadata.after
  if cursor is null: break
```

_Check fetched docs for exact pagination fields and cursor format._

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and has directory sync permissions |
| 404 | Resource not found | Verify ID format (users: `directory_user_*`, groups: `directory_group_*`, directories: `directory_*`) |
| 422 | Invalid query parameters | Check fetched docs for allowed filters and parameter types |
| 429 | Rate limit exceeded | Implement exponential backoff with jitter (start at 1s, max 60s) |

_Check fetched docs for complete error response schemas._

## Rate Limit Guidance

WorkOS Directory Sync APIs enforce rate limits per API key.

If you receive a 429 response:
1. Extract `Retry-After` header (seconds to wait)
2. Wait the specified duration before retrying
3. If no `Retry-After` header, use exponential backoff (1s, 2s, 4s, 8s, max 60s)

Pseudocode for retry logic:

```
max_retries = 3
retry_count = 0

loop:
  response = api_call()
  if response.status == 429:
    wait_seconds = response.headers.get("Retry-After", 2 ** retry_count)
    sleep(wait_seconds)
    retry_count += 1
    if retry_count > max_retries: raise error
  else:
    break
```

## Common Integration Patterns

### Syncing User Data to Your Database

```
1. Fetch all users for a directory
   GET /directory_users?directory={directory_id}
   
2. For each user in response.data:
   - Upsert user into your database by email or directory_user_id
   - Store state (active/inactive) and group memberships
   
3. Handle pagination:
   - Repeat request with after={cursor} until no more pages
```

### Checking Group Membership

```
1. Fetch a specific user
   GET /directory_users/{user_id}
   
2. Extract groups[] array from response
   - Each group object has { id, name }
   
3. Match group names against your internal role mapping
   - Example: "Engineering" → app role "developer"
```

### Monitoring Directory Health

```
1. List all directories for an organization
   GET /directories?organization={organization_id}
   
2. Check each directory's state field
   - "linked": directory is active and syncing
   - "unlinked": directory is disconnected
   - "deleting": directory deletion in progress
   
3. Alert if any directory is "unlinked" for > 24 hours
```

## Webhook Integration

Directory Sync events arrive via `dsync.*` webhook events. Set up webhook handling to stay in sync with provider changes.

**Event types to handle:**
- `dsync.user.created` — new user added to directory
- `dsync.user.updated` — user attributes changed
- `dsync.user.deleted` — user removed from directory
- `dsync.group.created` — new group added
- `dsync.group.updated` — group attributes changed
- `dsync.group.deleted` — group removed
- `dsync.group.user_added` — user added to group
- `dsync.group.user_removed` — user removed from group

Pseudocode for webhook handler:

```
POST /webhooks/workos:
  1. Verify webhook signature (see WorkOS webhook verification docs)
  2. Parse event.type
  3. Switch on event type:
     - dsync.user.created: upsert user to database
     - dsync.user.deleted: mark user inactive or delete
     - dsync.group.user_added: update user's group memberships
  4. Return 200 immediately (process async if needed)
```

_Check fetched docs for webhook signature verification and event schemas._

## Runnable Verification

### Test authentication and list directories

```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[0]'
```

Expected: JSON object with directory details

### List users in a specific directory

```bash
# Replace {directory_id} with actual directory ID from previous call
curl -X GET "https://api.workos.com/directory_users?directory={directory_id}&limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | {id, email, first_name, last_name, state}'
```

Expected: Array of user objects with specified fields

### Get a single user by ID

```bash
# Replace {user_id} with actual user ID (starts with directory_user_)
curl -X GET "https://api.workos.com/directory_users/{user_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '{email, groups: .groups[].name}'
```

Expected: User object with email and group names

### List groups in a directory

```bash
curl -X GET "https://api.workos.com/directory_groups?directory={directory_id}&limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | {id, name}'
```

Expected: Array of group objects with id and name

## Traps and Edge Cases

### Trap: Using organization_id as directory_id

- `organization_id` (starts with `org_`) identifies the WorkOS organization
- `directory_id` (starts with `directory_`) identifies a specific directory connection
- One organization can have multiple directories (e.g., Okta + Azure AD)
- Always fetch directories first, then query users/groups by `directory_id`

### Trap: Assuming email is unique across directories

- Different directories can have users with the same email
- Use `directory_user_id` (starts with `directory_user_`) as the unique identifier
- If matching by email, scope to a specific directory

### Trap: Not handling inactive users

- Users removed from provider appear as `state: "inactive"` (not deleted)
- Deleted users trigger `dsync.user.deleted` webhook events
- Filter by `state=active` in queries or handle both states in your application

### Trap: Polling instead of webhooks

- Polling `/directory_users` is inefficient and rate-limited
- Use webhooks (`dsync.*` events) for real-time updates
- Only poll on initial sync or webhook delivery failures

### Trap: Ignoring pagination

- Large directories (>100 users) require pagination
- Missing `after` cursor parameter causes incomplete data syncs
- Always check `list_metadata.after` and loop until null

## Related Skills

- workos-directory-sync (feature overview and webhook setup)
