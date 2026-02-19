---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | Retrieve a single event by ID |
| GET | `/events` | List events with optional filters |

## Authentication

All Events API calls require an API key in the `Authorization` header:

```bash
Authorization: Bearer sk_live_...
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_live_..."
```

## Operation Decision Tree

**When to use each endpoint:**

1. **Fetch a specific event by ID** → `GET /events/{event_id}`
   - You have an event ID from a webhook payload
   - You need to retrieve details of a past event
   - You're debugging a specific event

2. **List events (with filters)** → `GET /events?...`
   - You need to audit recent activity
   - You're building an event log viewer
   - You need to find events matching criteria (date range, event type, resource)

**Event type naming convention:**

All WorkOS events follow the pattern: `{domain}.{resource}.{action}`

Examples:
- `authentication.email_verification_succeeded`
- `dsync.group.created`
- `user.created`

Check fetched docs for the complete list of event types.

## Pagination Pattern

The Events API uses cursor-based pagination:

```
GET /events?limit=10&after=cursor_xyz
```

- `limit`: Number of events per page (check docs for max)
- `after`: Cursor for next page (returned in response)
- `before`: Cursor for previous page

**Pagination pseudocode:**

```
cursor = null
all_events = []

loop:
  response = fetch_events(after=cursor, limit=100)
  all_events.append(response.data)
  
  if response.list_metadata.after is null:
    break
  
  cursor = response.list_metadata.after
```

## Common Filtering Patterns

**Filter by event type:**

```bash
GET /events?events[]=dsync.user.created&events[]=dsync.user.updated
```

**Filter by date range:**

```bash
GET /events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z
```

**Filter by organization:**

```bash
GET /events?organization_id=org_123
```

Check fetched docs for the complete list of supported filter parameters.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | API key missing or malformed | Verify `Authorization: Bearer sk_...` header is present |
| 401 | API key invalid or expired | Regenerate API key in WorkOS Dashboard → API Keys |
| 404 | Event ID not found | Verify event ID format (`event_...`) and that event exists |
| 422 | Invalid filter parameters | Check fetched docs for valid parameter names and formats |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s, double on each retry) |
| 500 | WorkOS service error | Retry with exponential backoff; check WorkOS status page |

**Rate limit guidance:**

Check fetched docs for current rate limits. Implement retry logic with exponential backoff for 429 responses:

```
retry_delay = 1  # seconds
max_retries = 5

for attempt in range(max_retries):
  response = call_api()
  if response.status != 429:
    break
  
  sleep(retry_delay)
  retry_delay *= 2
```

## Verification Commands

**1. Test authentication and fetch latest event:**

```bash
curl -X GET https://api.workos.com/events?limit=1 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 response with one event object.

**2. Verify event filtering works:**

```bash
curl -X GET "https://api.workos.com/events?events[]=user.created&limit=5" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: 200 response with events matching the specified type.

**3. Test pagination:**

```bash
# First page
curl -X GET "https://api.workos.com/events?limit=2" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"

# Extract 'after' cursor from response, then:
curl -X GET "https://api.workos.com/events?limit=2&after=CURSOR_FROM_PREVIOUS_RESPONSE" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Expected: Second request returns different events.

## SDK Usage Pattern

Use the SDK method for listing events — check fetched docs for exact method signature for your language.

**Pseudocode pattern:**

```
workos = initialize_client(api_key=WORKOS_API_KEY)

# List events with filters
events = workos.events.list(
  events=['user.created', 'user.updated'],
  limit=50,
  after=cursor  # optional, for pagination
)

# Access results
for event in events.data:
  process_event(event.event_type, event.data)

# Get next page cursor
next_cursor = events.list_metadata.after
```

## Event Structure Overview

Every event contains these top-level fields:

- `id`: Event identifier (`event_...`)
- `event`: Event type string (`domain.resource.action`)
- `data`: Event payload (structure varies by event type)
- `created_at`: ISO 8601 timestamp

Check fetched docs for event-specific payload schemas.

## Trap Warnings

1. **Event retention**: WorkOS retains events for a limited time. Check fetched docs for current retention period. Don't rely on old events being available.

2. **Event ordering**: Events are returned in reverse chronological order (newest first). Do NOT assume events are delivered in strict order.

3. **Idempotency**: The same event will always have the same ID. Use event IDs to deduplicate if you're processing events from both webhooks and polling.

4. **Filter array syntax**: Event type filters use array notation: `events[]=type1&events[]=type2`. Single filters still need brackets: `events[]=type1`.

5. **Cursor expiration**: Pagination cursors expire. If you get a 422 on an `after` parameter, restart pagination from the beginning.

## Related Skills

- workos-webhooks (for event delivery via webhooks instead of polling)
