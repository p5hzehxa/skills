<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Authentication Setup

Set your API key as a bearer token in the Authorization header:

```bash
Authorization: Bearer sk_your_api_key_here
```

Verify your API key starts with `sk_` prefix. Find it in WorkOS Dashboard → API Keys.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List events with filtering and pagination |

## Operation Decision Tree

**When to use Events API:**
- Audit logging: retrieve historical activity across WorkOS resources
- Debugging: investigate specific SSO or Directory Sync operations
- Analytics: build reports on authentication patterns or provisioning activity
- Compliance: export event data for security reviews

**Query patterns:**
- List recent events: `GET /events?limit=10&order=desc`
- Filter by event type: `GET /events?events[]=dsync.user.created`
- Filter by organization: `GET /events?organization_id=org_123`
- Paginate results: `GET /events?after=event_123`

## Event Type Naming Convention

All WorkOS events follow the pattern: `{domain}.{resource}.{action}`

Examples:
- `dsync.user.created` — Directory Sync user provisioned
- `sso.connection.activated` — SSO connection enabled
- `directory.user_created` — Directory user added
- `connection.activated` — Connection state changed

Check fetched docs for complete event type catalog.

## Pagination Pattern

The Events API uses cursor-based pagination:

1. First request: `GET /events?limit=25`
2. Response includes `list_metadata.after` cursor if more results exist
3. Next page: `GET /events?limit=25&after={cursor_value}`
4. Continue until `list_metadata.after` is null

**Pseudocode:**
```
cursor = null
all_events = []

loop:
  response = fetch_events(limit=25, after=cursor)
  all_events.append(response.data)
  
  if response.list_metadata.after is null:
    break
  cursor = response.list_metadata.after

return all_events
```

## Query Parameters

Check fetched docs for complete parameter list and validation rules. Common filters:

- `events[]` — filter by event types (array, repeatable)
- `organization_id` — filter by organization (string)
- `limit` — results per page (check docs for min/max)
- `after` — cursor for pagination (string)
- `range_start` / `range_end` — time window (ISO 8601 timestamps)
- `order` — sort direction (`asc` or `desc`)

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Missing or invalid API key | Verify `Authorization: Bearer sk_...` header is set |
| 401 | API key lacks read permissions | Check key permissions in WorkOS Dashboard |
| 400 | Invalid event type in filter | Check fetched docs for valid event type list |
| 400 | Invalid date format in range filter | Use ISO 8601 format: `2024-01-15T10:30:00Z` |
| 400 | Invalid cursor in `after` param | Cursors are opaque — only use values from previous responses |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay, double each retry) |

## Rate Limit Guidance

Check fetched docs for current rate limits. When hitting 429 responses:

1. Read `Retry-After` header for wait time
2. Implement exponential backoff: 1s → 2s → 4s → 8s
3. Consider reducing `limit` parameter to make smaller requests
4. Cache event data if polling frequently

## Runnable Verification

Test your integration with this curl command:

```bash
curl https://api.workos.com/events \
  -H "Authorization: Bearer sk_your_api_key_here" \
  -H "Content-Type: application/json"
```

**Expected response structure:**
```json
{
  "data": [
    {
      "id": "event_123",
      "event": "dsync.user.created",
      "created_at": "2024-01-15T10:30:00.000Z",
      "data": { /* event payload */ }
    }
  ],
  "list_metadata": {
    "after": "event_456"
  }
}
```

## SDK Usage Pattern

Use your language's WorkOS SDK to list events. Check fetched docs for exact method signature in your SDK version:

```
# Pseudocode pattern
events = workos.events.list(
  limit=25,
  events=['dsync.user.created', 'sso.connection.activated'],
  organization_id='org_123'
)

for event in events.data:
  process(event)
```

## Common Traps

1. **Baked-in cursors**: Never hardcode `after` cursor values — they're opaque and expire
2. **Event type typos**: Event types are case-sensitive — `dsync.user.created` ≠ `dsync.User.Created`
3. **Timezone assumptions**: All timestamps are UTC — convert to local time in your application
4. **Missing filters**: Without filters, you get ALL event types — add `events[]` param to avoid noise
5. **Cursor reuse**: Don't reuse cursors across different filter sets — each query needs its own pagination flow

## Webhook Alternative

Events API is for PULL-based event retrieval. For PUSH-based notifications, use WorkOS Webhooks instead. The Events API is useful for:
- Backfilling missed webhook deliveries
- Auditing historical data
- One-off investigations

Check `workos-api-webhooks` skill for push-based event handling.

## Related Skills

- workos-api-webhooks — push-based event notifications
- workos-api-organizations — filtering events by organization context
