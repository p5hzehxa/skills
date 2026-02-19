<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/audit-logs
- https://workos.com/docs/reference/audit-logs/configuration
- https://workos.com/docs/reference/audit-logs/event
- https://workos.com/docs/reference/audit-logs/event/create
- https://workos.com/docs/reference/audit-logs/export
- https://workos.com/docs/reference/audit-logs/export/create
- https://workos.com/docs/reference/audit-logs/export/get
- https://workos.com/docs/reference/audit-logs/retention

## Prerequisites

- A WorkOS account with API key (`WORKOS_API_KEY` starting with `sk_`)
- Organization ID (`org_*`) for the target organization
- WorkOS SDK installed OR ability to make REST API calls

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Emit a single audit log event |
| POST | `/audit_logs/exports` | Create an export of audit log events |
| GET | `/audit_logs/exports/:id` | Retrieve the status and CSV URL of an export |

## Authentication Setup

Include your API key in the `Authorization` header:

```
Authorization: Bearer sk_test_...
```

Set `WORKOS_API_KEY` environment variable for SDK usage.

## Operation Decision Tree

### When to use each endpoint:

**Creating Events** → POST `/events`
- Use for: Real-time audit logging as actions occur
- Pattern: Fire-and-forget (returns 200 immediately)
- Verification: Check WorkOS Dashboard → Audit Logs for event appearance

**Exporting Events** → POST `/audit_logs/exports` then GET `/audit_logs/exports/:id`
- Use for: Bulk retrieval, compliance reports, external archival
- Pattern: Async job (create export → poll for completion → download CSV)
- Verification: Check export status transitions to `ready` and CSV URL is accessible

## Event Creation Pattern

### Decision: Which fields to include?

**Required (check fetched docs for current requirements):**
- `organization_id` — target organization
- `event.action` — what happened (naming convention: `{resource}.{action}`)
- `event.occurred_at` — ISO 8601 timestamp

**Actor identification (choose one):**
- `event.actor.id` + `event.actor.type` — for known users
- `event.actor.name` — for system actors or anonymous actions

**Context enrichment (optional but recommended):**
- `event.targets` — array of affected resources
- `event.metadata` — custom key-value pairs
- `ip_address` — source IP for security context

### Pseudocode Pattern

```
# Emit event after successful action
perform_business_action()

POST /events with:
  organization_id: current_org_id
  event:
    action: "document.created"
    occurred_at: now_iso8601
    actor:
      id: current_user_id
      type: "user"
    targets:
      - type: "document"
        id: new_document_id
    metadata:
      document_type: "invoice"
```

## Export Creation Pattern

### Decision: Filtering exports

**Time range filtering:**
- `range_start` / `range_end` — ISO 8601 timestamps
- Default: Last 30 days if not specified

**Actor filtering:**
- `actor_name` — exact match on actor name
- `actor_id` — exact match on actor ID

### Pseudocode Pattern

```
# Create export
response = POST /audit_logs/exports with:
  organization_id: target_org_id
  range_start: "2024-01-01T00:00:00Z"
  range_end: "2024-01-31T23:59:59Z"

export_id = response.id

# Poll for completion (check fetched docs for state values)
while true:
  status_response = GET /audit_logs/exports/{export_id}
  
  if status_response.state == "ready":
    csv_url = status_response.url
    download(csv_url)
    break
  
  if status_response.state == "error":
    handle_export_failure()
    break
  
  sleep(5_seconds)
```

## Error Code Mapping

**401 Unauthorized**
- Cause: API key missing or malformed
- Fix: Verify `Authorization: Bearer sk_...` header format
- Fix: Confirm key starts with `sk_` (not `pk_`)

**403 Forbidden**
- Cause: API key lacks audit log permissions
- Fix: Check WorkOS Dashboard → API Keys → verify key has "Audit Logs" scope

**404 Not Found (on export retrieval)**
- Cause: Export ID doesn't exist or expired
- Fix: Exports expire after 7 days — create new export if needed
- Fix: Verify export belongs to the organization you're querying

**422 Unprocessable Entity**
- Cause: Invalid event schema (check fetched docs for required fields)
- Common trap: `occurred_at` not ISO 8601 format
- Common trap: `actor.type` not in allowed values
- Fix: Validate payload against schema before sending

**429 Too Many Requests**
- Cause: Rate limit exceeded
- Fix: Implement exponential backoff (start at 1s, double each retry)
- Fix: Check `Retry-After` header for recommended wait time

## Pagination Handling

**Event Creation:** No pagination (single event per request)

**Export Retrieval:** Exports return ALL matching events in CSV format (no pagination needed)

## Runnable Verification

### Verify Event Creation

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H...",
    "event": {
      "action": "test.verification",
      "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "actor": {
        "type": "user",
        "id": "test_user_123"
      }
    }
  }'
```

Expected response: `200 OK` with empty body (fire-and-forget)

### Verify Export Creation

```bash
# Create export
EXPORT_ID=$(curl -X POST https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H...",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-12-31T23:59:59Z"
  }' | jq -r '.id')

# Check status
curl https://api.workos.com/audit_logs/exports/$EXPORT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected response: `{ "state": "pending", ... }` → eventually `{ "state": "ready", "url": "https://...", ... }`

## Rate Limit Guidance

- Event creation: High throughput (check fetched docs for current limits)
- Export creation: Lower limit (designed for periodic batch operations)
- Strategy: Queue events in-memory or via message broker, flush in batches
- Retry logic: Exponential backoff with jitter (base delay 1s, max 60s)

## Common Traps

**Trap: Assuming event creation is synchronous**
- POST `/events` returns 200 immediately (before processing)
- Events may take seconds to appear in Dashboard
- Do NOT poll Dashboard immediately after creation for verification

**Trap: Polling exports too aggressively**
- Export processing takes 30s–5min depending on data volume
- Poll every 5–10 seconds, not continuously
- Exports expire after 7 days — download CSV promptly

**Trap: Using `event.occurred_at` as "event ID"**
- Multiple events can have identical timestamps
- Do NOT use `occurred_at` for deduplication
- Idempotency: Emit events once per business action, not per retry

**Trap: Forgetting organization context**
- All operations require `organization_id`
- Events without org context will be rejected
- Exports scoped to single organization per request

## Configuration Setup

**Dashboard Settings (WorkOS Dashboard → Audit Logs):**
- Event retention period: 30/90/180/365 days (check fetched docs for options)
- Export retention: 7 days (CSV URL expiration)
- Actor type definitions: Custom types beyond "user" (check configuration docs)

**Environment Variables:**
```bash
WORKOS_API_KEY=sk_test_...  # Secret key (never commit)
```

## Related Skills

- workos-user-management (for actor identity integration)
