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

## Authentication Setup

Set these environment variables:

```bash
export WORKOS_API_KEY="sk_live_..." # or sk_test_...
```

All API requests require the API key in the Authorization header:

```bash
Authorization: Bearer sk_live_...
```

Verify authentication works:

```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected response: 200 OK with directory list (may be empty).

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/directories` | List directories for an organization |
| GET | `/directories/:id` | Get directory details |
| GET | `/directory_users` | List users from synced directories |
| GET | `/directory_users/:id` | Get specific user details |
| GET | `/directory_groups` | List groups from synced directories |
| GET | `/directory_groups/:id` | Get specific group details |

## Operation Decision Tree

### "I need to sync users from a customer's IdP"
1. Customer connects their IdP via WorkOS Dashboard → creates a directory
2. Poll `GET /directory_users?directory=directory_123` to get synced users
3. Map synced users to your database (store `directory_user.id` for reconciliation)

### "I need to know which users belong to which groups"
1. Fetch user: `GET /directory_users/:id`
2. Check `groups` array in response (contains group IDs)
3. Fetch group details: `GET /directory_groups/:group_id`

### "I need to filter users by organization"
Use `organization` query parameter:
```bash
GET /directory_users?organization=org_123
```

### "I need to handle directory updates"
Directory Sync is **eventually consistent**. Changes in the IdP appear in WorkOS within minutes (not instant).

**Pattern:**
1. Listen for `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted` webhooks (see workos-api-webhooks skill)
2. Use webhook payload's `user.id` to fetch latest state: `GET /directory_users/:id`
3. Update your local user records

Do NOT poll the API continuously. Use webhooks for change detection.

## Pagination Pattern

List endpoints (`/directory_users`, `/directory_groups`, `/directories`) support cursor pagination:

```bash
GET /directory_users?limit=100&after=cursor_abc123
```

**Pattern:**
```
page1 = GET /directory_users?limit=100
if page1.list_metadata.after:
    page2 = GET /directory_users?limit=100&after={page1.list_metadata.after}
```

Repeat until `list_metadata.after` is null.

## Common Error Codes

| Code | Cause | Fix |
|------|-------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is not revoked |
| 403 | API key lacks Directory Sync permission | Check key permissions in WorkOS Dashboard → API Keys |
| 404 | Directory/user/group not found | Verify ID exists (may have been deleted) |
| 422 | Invalid query parameter | Check fetched docs for valid parameter names and formats |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay, double each retry) |

**Trap:** 404 on `/directory_users/:id` can mean the user was deprovisioned in the IdP. Check `dsync.user.deleted` webhook history.

## Rate Limits

Check fetched docs for current rate limits. General guidance:
- List endpoints: Use pagination, don't fetch all users repeatedly
- Webhook-driven updates are more efficient than polling

## SDK Usage Patterns

### List Users (Node.js example pattern)

```javascript
// Pseudocode — check SDK docs for exact method signature
const users = await workos.directorySync.listUsers({
  directory: 'directory_123',
  limit: 100
});

// Pagination
let after = users.listMetadata.after;
while (after) {
  const nextPage = await workos.directorySync.listUsers({
    directory: 'directory_123',
    limit: 100,
    after: after
  });
  after = nextPage.listMetadata.after;
}
```

### Get User by ID

```javascript
const user = await workos.directorySync.getUser('directory_user_123');
// user.groups contains group IDs
```

### Get Group by ID

```javascript
const group = await workos.directorySync.getGroup('directory_group_123');
```

## Verification Commands

### 1. Verify API key works
```bash
curl -X GET https://api.workos.com/directories \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```
Expected: 200 OK with `{ data: [], list_metadata: {...} }` or populated array.

### 2. List users from a directory
```bash
curl -X GET "https://api.workos.com/directory_users?directory=directory_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```
Expected: 200 OK with users array. 404 if directory doesn't exist.

### 3. Get specific user
```bash
curl -X GET https://api.workos.com/directory_users/directory_user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```
Expected: 200 OK with user object including `groups` array.

## Integration Traps

### Trap: Assuming instant sync
Directory changes take time to propagate. Don't refresh immediately after a change in the IdP.

**Fix:** Wait for webhooks. If polling, wait at least 5 minutes between checks.

### Trap: Storing user emails as primary keys
User emails can change in the IdP. Store `directory_user.id` as the stable identifier.

### Trap: Not handling deleted users
When a user is deprovisioned, you'll get a `dsync.user.deleted` webhook. The user's `GET /directory_users/:id` endpoint will return 404.

**Fix:** Map deletion events to your user deactivation logic.

### Trap: Filtering by email in list endpoint
Check fetched docs for supported query parameters. Email filtering may not be available — fetch all users and filter locally, or use webhooks to maintain a synced copy.

## Related Skills

- **workos-directory-sync** — Feature overview and setup guide (start here for initial implementation)
- **workos-api-webhooks** — Handling Directory Sync webhooks (`dsync.*` events)
- **workos-api-organizations** — Linking directories to organizations
