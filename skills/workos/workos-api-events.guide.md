<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Prerequisites

- A WorkOS account with API keys (`WORKOS_API_KEY` starting with `sk_`)
- WorkOS SDK installed (any language)
- Bearer token authentication configured

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List events with filtering and pagination |

This API is read-only — you retrieve events WorkOS generates, not create them.

## Authentication Setup

Include your API key as a Bearer token in every request:

```bash
Authorization: Bearer sk_your_api_key
```

Set the environment variable:

```bash
export WORKOS_API_KEY="sk_your_api_key"
```

## Event Type Naming Convention

WorkOS events follow this pattern:

```
{domain}.{resource}.{action}
```

Examples:
- `dsync.user.created`
- `dsync.group.deleted`
- `authentication.email_verification_succeeded`

Check fetched docs for the complete event type catalog.

## Operation Decision Tree

**To monitor recent activity:**
- Use GET `/events` with no filters
- Returns events in reverse chronological order (newest first)

**To track specific event types:**
- Use GET `/events` with `events` parameter
- Pass comma-separated event type list: `?events=dsync.user.created,dsync.user.updated`

**To monitor a specific organization:**
- Use GET `/events` with `organization_id` parameter
- Example: `?organization_id=org_01H7Y8Z9W6XZQJN8F5KPQV3M4R`

**To replay events from a checkpoint:**
- Use GET `/events` with `after` cursor parameter
- Cursor format: `evt_` prefix + ID
- Process events, store last cursor, resume with `?after=evt_last_processed`

## Pagination Pattern

The Events API uses cursor-based pagination:

1. Initial request: GET `/events?limit=50`
2. Response includes `list_metadata.after` cursor if more results exist
3. Next page: GET `/events?after=evt_cursor_value&limit=50`
4. Repeat until `list_metadata.after` is null

Pseudocode:
```
cursor = null
all_events = []

loop:
  response = fetch_events(after=cursor, limit=50)
  all_events.append(response.data)
  cursor = response.list_metadata.after
  if cursor is null: break

return all_events
```

## Rate Limiting

Check fetched docs for current rate limits. If you hit a 429 response:

1. Read `Retry-After` header (seconds to wait)
2. Implement exponential backoff: retry after 1s, 2s, 4s, 8s...
3. For bulk processing, add 100ms delay between requests

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 403 | API key lacks Events API permission | Check key permissions in WorkOS Dashboard → API Keys |
| 404 | Invalid cursor or event ID | Cursor may be expired — restart from beginning or use recent cursor |
| 422 | Invalid query parameters | Check parameter spelling and format in fetched docs |
| 429 | Rate limit exceeded | Implement exponential backoff, check `Retry-After` header |
| 500 | WorkOS service error | Retry with exponential backoff, check status.workos.com |

## Runnable Verification

Test your Events API integration:

```bash
# List recent events (returns empty array if no events yet)
curl "https://api.workos.com/events?limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Filter by event type
curl "https://api.workos.com/events?events=dsync.user.created&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Filter by organization
curl "https://api.workos.com/events?organization_id=org_your_org_id&limit=10" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected response structure:
```json
{
  "data": [...],
  "list_metadata": {
    "after": "evt_...",
    "before": "evt_..."
  }
}
```

## Common Integration Patterns

### Webhook Alternative Pattern

Use the Events API to poll for changes instead of webhooks:

1. Store last processed cursor in your database
2. Every N seconds: `GET /events?after=stored_cursor&limit=100`
3. Process new events
4. Update stored cursor to `list_metadata.after` from response

### Event Type Filtering Strategy

**Anti-pattern:** Fetch all events and filter client-side
**Better:** Use `events` parameter to filter server-side

```bash
# Bad: transfers unnecessary data
GET /events?limit=1000
# (then filter in application code)

# Good: server-side filter
GET /events?events=dsync.user.created,dsync.user.updated&limit=100
```

### Cursor Checkpoint Strategy

Store cursors per organization to resume processing after failures:

```
checkpoints = {
  "org_abc": "evt_123",
  "org_xyz": "evt_456"
}

for org_id in organizations:
  cursor = checkpoints[org_id]
  events = fetch_events(organization_id=org_id, after=cursor)
  process(events)
  checkpoints[org_id] = events.list_metadata.after
```

## Related Skills

- **workos-events** — High-level Events feature overview and use cases
