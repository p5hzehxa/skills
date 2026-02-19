<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

Check fetched docs for exact request/response schemas, behavioral requirements, and rate limits.

## Prerequisites

- A WorkOS account with API keys (`WORKOS_API_KEY` starting with `sk_`)
- WorkOS SDK installed (or curl for REST API calls)
- Environment variables configured

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/events` | List events with pagination and filtering |
| GET | `/events/:id` | Retrieve a specific event by ID |

## Authentication

All requests require the `Authorization` header:

```bash
Authorization: Bearer sk_your_api_key_here
```

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_your_api_key_here"
```

## Event Types and Structure

WorkOS events follow the naming convention: `{domain}.{resource}.{action}`

Common event domains:
- `authentication` — AuthKit events (session created, password reset, etc.)
- `directory_sync` — Directory events (user created, group updated, etc.)
- `sso` — SSO connection events
- `organization` — Organization lifecycle events
- `connection` — Connection state changes

Check fetched docs for the complete event type catalog and payload schemas.

## Operation Decision Tree

**When to list events:**
- Building an audit log viewer
- Syncing events to external systems
- Debugging integration issues
- Monitoring specific event types

**When to fetch a specific event:**
- Verifying webhook delivery (match webhook event ID to API event)
- Retrieving full event context after receiving notification
- Investigating a specific incident by event ID

## Listing Events

### Basic Pattern

```bash
curl "https://api.workos.com/events" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Filtering by Event Type

To monitor specific events, filter by event type:

```bash
curl "https://api.workos.com/events?events[]=authentication.session_created" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Pass multiple event types by repeating the `events[]` parameter.

### Filtering by Organization

To scope events to a specific organization:

```bash
curl "https://api.workos.com/events?organization_id=org_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Pagination

Events are paginated. Check fetched docs for the exact pagination mechanism (cursor-based or offset-based) and response structure.

**Pattern:**
1. Make initial request
2. Check response for pagination metadata
3. Use next page token/cursor from response for subsequent requests
4. Continue until no more pages

## Retrieving a Specific Event

```bash
curl "https://api.workos.com/events/event_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Use this to:
- Verify webhook event delivery
- Get full event payload after receiving abbreviated notification
- Investigate specific event IDs from logs

## Error Handling

### HTTP 401 Unauthorized

**Cause:** Invalid or missing API key

**Fix:**
```bash
# Verify key format
echo $WORKOS_API_KEY  # Should start with sk_

# Check key in WorkOS Dashboard → API Keys
# Ensure key is active and not deleted
```

### HTTP 404 Not Found

**Cause:** Event ID does not exist or belongs to different environment

**Fix:**
- Verify event ID format (should start with `event_`)
- Check you're using correct API key (test vs production)
- Event may have been deleted or aged out (check retention policy)

### HTTP 429 Too Many Requests

**Cause:** Rate limit exceeded

**Fix:**
- Implement exponential backoff retry logic
- Check fetched docs for current rate limits
- Consider caching frequently accessed events

### HTTP 500 Internal Server Error

**Cause:** WorkOS service issue

**Fix:**
- Retry with exponential backoff (start at 1s, max 60s)
- Check WorkOS status page
- If persists, contact WorkOS support with request ID from response headers

## Verification Commands

### Test API Key

```bash
curl -I "https://api.workos.com/events?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Success: HTTP 200 response

### Verify Event Type Filtering

```bash
curl "https://api.workos.com/events?events[]=authentication.session_created&limit=5" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data[].event'
```

All returned events should match the filtered type.

### Fetch Specific Event by ID

```bash
# Get an event ID from list response
EVENT_ID=$(curl "https://api.workos.com/events?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.data[0].id')

# Fetch that specific event
curl "https://api.workos.com/events/$EVENT_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.'
```

Should return the full event object.

## SDK Usage Pattern

If using the WorkOS SDK:

```python
# Python example pattern
from workos import WorkOSClient

client = WorkOSClient(api_key=os.environ['WORKOS_API_KEY'])

# List events
events = client.events.list_events(
    events=['authentication.session_created'],
    limit=10
)

# Get specific event
event = client.events.get_event('event_123')
```

Check fetched docs for exact SDK method signatures for your language.

## Common Integration Patterns

### Building an Audit Log

1. List events with appropriate filters (organization_id, event types)
2. Implement pagination to retrieve all relevant events
3. Store events in your database with indexed timestamps
4. Display in UI with filtering and search

### Event-Driven Automation

1. Use webhooks (separate skill) for real-time notifications
2. Fall back to polling `/events` endpoint if webhook delivery fails
3. Store last processed event ID to avoid duplicates
4. Implement idempotent event handlers

### Debugging Integration Issues

1. List recent events filtered by affected resource (organization, user)
2. Compare event payloads to expected values
3. Check event timestamps against application logs
4. Verify event sequence (created → updated → deleted)

## Related Skills

- **workos-webhooks** — Real-time event delivery via webhooks (recommended over polling)
- **workos-organizations** — Organization management (events reference org_id)
- **workos-api-directory-sync** — Directory events are part of Events API
