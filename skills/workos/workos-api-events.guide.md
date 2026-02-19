<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Prerequisites

- A WorkOS account with API keys (`WORKOS_API_KEY` starting with `sk_`)
- WorkOS SDK installed in your project
- Webhook endpoint configured if consuming events via webhooks

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List all events with filtering and pagination |

## Authentication Setup

All Events API requests require Bearer token authentication:

```bash
Authorization: Bearer <WORKOS_API_KEY>
```

The API key must start with `sk_` prefix. Verify in WorkOS Dashboard under API Keys.

## Operation Decision Tree

### When to use the Events API

**List historical events** → `GET /events`
- Use case: audit logs, compliance reporting, debugging
- Supports filtering by event type, resource, and time range
- Check fetched docs for available filter parameters

**Real-time event processing** → Webhooks (see Related Skills)
- Use case: triggering automated workflows
- Events API is for historical queries, NOT real-time triggers

## Event Type Naming Convention

WorkOS events follow the pattern: `{domain}.{resource}.{action}`

Examples:
- `directory.user.created`
- `directory.group.updated`
- `dsync.activated`

Check fetched docs for complete event catalog with payload schemas.

## Pagination Handling

The Events API uses cursor-based pagination:

```
GET /events?limit=10&after=<cursor>
```

**Pattern:**
1. Initial request: `GET /events?limit=10`
2. Response includes `list_metadata.after` cursor if more pages exist
3. Next request: `GET /events?limit=10&after=<cursor_from_step_2>`
4. Repeat until `list_metadata.after` is null

Check fetched docs for exact cursor field names and default limits.

## Filtering Events

**By event type:**
```bash
GET /events?events[]=directory.user.created&events[]=directory.user.updated
```

**By time range:**
```bash
GET /events?range_start=2024-01-01T00:00:00Z&range_end=2024-01-31T23:59:59Z
```

**By organization:**
```bash
GET /events?organization_id=org_01H5K8P...
```

Check fetched docs for complete filter parameter reference.

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Missing or invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and has not been rotated |
| 403 | API key lacks Events API permission | Check Dashboard → API Keys → Key Permissions |
| 422 | Invalid query parameters | Validate filter syntax (e.g., date format, event type names) |
| 429 | Rate limit exceeded | Implement exponential backoff with jitter (see Rate Limits) |

Check fetched docs for additional status codes and error response schemas.

## Rate Limits

The Events API enforces rate limits per API key. 

**Strategy:**
- Track rate limit headers in responses (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- Implement exponential backoff: 1s, 2s, 4s, 8s delays
- Add jitter to backoff to prevent thundering herd

Check fetched docs for exact rate limit values.

## Runnable Verification

**Test API connectivity:**
```bash
curl -X GET https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with `data` array (may be empty if no events exist).

**Test filtering:**
```bash
curl -X GET "https://api.workos.com/events?limit=5&events[]=directory.user.created" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with filtered events.

**SDK verification (pseudocode):**
```
client = WorkOS(api_key=WORKOS_API_KEY)
events = client.events.list(limit=10)
print(events.data)
```

Check fetched docs for SDK method signatures in your language.

## Common Integration Patterns

### Pattern 1: Audit Log Query
```
1. Fetch events for specific organization
2. Filter by time range (last 30 days)
3. Filter by event types (user.created, user.updated, user.deleted)
4. Paginate through all results
5. Store in audit database
```

### Pattern 2: Compliance Reporting
```
1. Schedule daily job
2. Fetch previous day's events (range_start/range_end)
3. Aggregate by event type
4. Generate compliance report
```

### Pattern 3: Event Replay for Debugging
```
1. Identify timestamp of issue
2. Fetch events around that time (±1 hour)
3. Filter by affected resource (organization_id, connection_id, etc.)
4. Reconstruct event sequence
```

## Traps and Gotchas

1. **Events API is NOT for real-time processing** — use webhooks for automation. Events API has built-in latency (up to 60 seconds) and is designed for historical queries.

2. **Event retention** — events are retained for a limited period. Check fetched docs for retention policy. Do not rely on Events API for long-term storage.

3. **Cursor expiration** — pagination cursors may expire after a period of inactivity. If pagination fails with 422, restart from the beginning.

4. **Event ordering** — events are ordered by creation time, but near-simultaneous events may appear out of order. Do NOT assume strict ordering for events within the same second.

5. **Filter array syntax** — event type filters use `events[]` (plural with brackets), not `event` or `events`. Verify exact syntax in fetched docs.

## Related Skills

- **workos-webhooks** — real-time event consumption (recommended for automation)
- **workos-directory-sync** — generates directory.* events
- **workos-organizations** — generates organization.* events
