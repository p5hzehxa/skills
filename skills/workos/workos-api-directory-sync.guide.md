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

_2 additional doc pages available at https://workos.com/docs_

## Core Concepts

Directory Sync syncs identity provider data (users, groups) to your app. Key concepts:

- **Directory** (`directory_*`) — connection to an identity provider (Okta, Azure AD, Google Workspace)
- **Directory User** (`directory_user_*`) — synced user record with email, name, state (active/inactive)
- **Directory Group** (`directory_group_*`) — synced group with members
- **Organization** (`org_*`) — your customer; directories belong to organizations

## Authentication

Set API key in Authorization header:

```bash
Authorization: Bearer sk_live_1234567890
```

Use `WORKOS_API_KEY` environment variable (starts with `sk_test_` or `sk_live_`).

## Endpoint Catalog

### Directories

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directories` | List all directories |
| GET | `/directories/{id}` | Get single directory |
| DELETE | `/directories/{id}` | Delete directory |

### Directory Users

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directory_users` | List users across directories |
| GET | `/directory_users/{id}` | Get single user |

### Directory Groups

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directory_groups` | List groups across directories |
| GET | `/directory_groups/{id}` | Get single group |

## Operation Decision Tree

**Task: Sync user data from identity provider**

1. List users for a directory → `GET /directory_users?directory={directory_id}`
2. Get specific user details → `GET /directory_users/{user_id}`
3. Check user state → read `state` field (active/inactive/suspended)

**Task: Sync group memberships**

1. List groups for a directory → `GET /directory_groups?directory={directory_id}`
2. Get group with members → `GET /directory_groups/{group_id}` (members included in response)

**Task: Find which directory a user belongs to**

1. List users with filter → `GET /directory_users?user={email_or_id}`
2. Read `directory_id` from response

**Task: Handle real-time sync events**

→ Use webhooks instead (see workos-webhooks skill). API endpoints are for polling/bulk reads, not real-time updates.

## Pagination Pattern

All list endpoints support cursor pagination:

```bash
# First page
GET /directory_users?directory=directory_123&limit=100

# Response includes `list_metadata.after` cursor
# Next page
GET /directory_users?directory=directory_123&limit=100&after=cursor_xyz
```

Continue until `list_metadata.after` is null. Default limit is 10, max is 100.

## Common Filtering Patterns

### List users for a specific directory

```bash
GET /directory_users?directory=directory_01ABCD
```

### List groups for an organization

```bash
GET /directory_groups?organization=org_01EFGH
```

### Get user by email

```bash
GET /directory_users?user=alice@example.com
```

Check fetched docs for complete list of filter parameters.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in dashboard |
| 404 | Resource not found | Check ID format (`directory_*`, `directory_user_*`, `directory_group_*`) and that resource exists |
| 422 | Invalid filter parameter | Check fetched docs for allowed filters on the endpoint |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s, double on each retry, max 32s) |

## SDK Usage Patterns

### List users for a directory (pseudocode)

```javascript
// Fetch all users with pagination
const users = await sdk.directorySync.listUsers({
  directory: 'directory_01ABCD',
  limit: 100
});

// Check fetched docs for exact method signature and response structure
```

### Get user details

```javascript
const user = await sdk.directorySync.getUser({
  user: 'directory_user_01FGHIJ'
});

// user.state is 'active', 'inactive', or 'suspended'
// user.emails[0].primary indicates primary email
```

### List groups with members

```javascript
const groups = await sdk.directorySync.listGroups({
  directory: 'directory_01ABCD'
});

// Each group includes members array
// group.id, group.name, group.directory_id
```

Check fetched docs for exact SDK method names and parameter signatures for your language.

## Runnable Verification

Verify API access and directory exists:

```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Should return 200 with list of directories
```

Verify user listing for a directory:

```bash
curl -X GET "https://api.workos.com/directory_users?directory=directory_01ABCD" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Should return 200 with user list (may be empty if no users synced yet)
```

Test pagination:

```bash
curl -X GET "https://api.workos.com/directory_users?directory=directory_01ABCD&limit=2" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Check response for list_metadata.after cursor
# Use it in next request: &after=<cursor>
```

## Rate Limits

WorkOS enforces rate limits per API key. Check response headers:

- `X-RateLimit-Limit` — requests allowed per window
- `X-RateLimit-Remaining` — requests left in window
- `X-RateLimit-Reset` — unix timestamp when limit resets

On 429, implement exponential backoff with jitter.

## Edge Cases and Traps

**Trap: Polling for updates**
Directory Sync data changes via identity provider events. Polling `GET /directory_users` every N seconds is inefficient. Use webhooks (`dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`) instead.

**Trap: Assuming user emails are unique**
Users can have multiple email addresses. Check `emails[].primary` to find the primary email. Don't assume `emails[0]` is primary.

**Trap: Treating inactive users as deleted**
`state: inactive` means deprovisioned in IdP, NOT deleted. Inactive users remain in WorkOS for audit/recovery. If you soft-delete users, map both `inactive` and `suspended` to your soft-delete state.

**Trap: Missing directory ownership**
A directory belongs to an organization (`directory.organization_id`). Always scope user/group queries by `directory` or `organization` to avoid cross-tenant data leaks.

**Trap: Not handling pagination**
Without pagination, you'll only get first 10 results. Always check `list_metadata.after` and loop until null.

## Related Skills

- workos-directory-sync — feature overview and webhook setup (use for real-time sync)
