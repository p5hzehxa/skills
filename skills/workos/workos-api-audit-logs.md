---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

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

## Available Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST | `/events` | Create a single audit log event |
| POST | `/exports` | Create an export of audit log events |
| GET | `/exports/:id` | Retrieve status and download URL for an export |
| POST | `/schemas` | Create a custom audit log schema |
| GET | `/schemas` | List all audit log schemas for an organization |
| GET | `/schemas/actions` | List all available action types across schemas |
| GET | `/retention` | Get current retention policy |
| PUT | `/retention` | Set retention policy (days to retain logs) |

## Authentication Setup

Set your API key as a bearer token in the Authorization header:

```bash
Authorization: Bearer sk_live_your_api_key_here
```

Verify authentication works:

```bash
curl https://api.workos.com/audit_logs/schemas \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with schema list (may be empty if none configured).

## Operation Decision Tree

**Creating audit events:**
- Single event → POST `/events` with event object
- Bulk events → Call POST `/events` multiple times (no batch endpoint)
- Asynchronous → Events return 200 immediately, processing happens async

**Exporting audit logs:**
- Recent events (< 30 days) → POST `/exports` with date range filters
- Historical analysis → POST `/exports`, poll GET `/exports/:id` until `state: "ready"`
- Download CSV → Use `url` field from export response once ready

**Schema management:**
- First-time setup → POST `/schemas` to define event types
- Viewing configured schemas → GET `/schemas`
- Listing all possible actions → GET `/schemas/actions`

**Retention configuration:**
- Check current policy → GET `/retention`
- Set retention period → PUT `/retention` with `days` (min 30, max varies by plan)

## Event Creation Pattern

```pseudocode
POST /events
Headers:
  Authorization: Bearer $WORKOS_API_KEY
  Content-Type: application/json
  Idempotency-Key: <unique-key-for-this-event>

Body:
  organization_id: "org_12345"
  event:
    action: "user.created"           # Format: {resource}.{action}
    occurred_at: "2024-01-15T10:30:00Z"
    actor:
      id: "user_abc"
      name: "Jane Doe"
      type: "user"
    targets:
      - id: "user_xyz"
        type: "user"
    context:
      location: "192.168.1.1"
      user_agent: "Mozilla/5.0..."
    metadata:
      custom_field: "custom_value"

Response: 200 (event accepted, async processing)
```

**Idempotency:** Use `Idempotency-Key` header to prevent duplicate events. Same key within 24 hours = deduplication.

## Export Pattern

```pseudocode
# Step 1: Create export
POST /exports
Body:
  organization_id: "org_12345"
  range_start: "2024-01-01T00:00:00Z"
  range_end: "2024-01-31T23:59:59Z"
  actions: ["user.created", "user.deleted"]  # Optional filter
  actors: ["user_abc"]                       # Optional filter

Response:
  id: "audit_log_export_123"
  state: "pending"
  created_at: "..."

# Step 2: Poll for completion
GET /exports/audit_log_export_123

Response (when ready):
  id: "audit_log_export_123"
  state: "ready"
  url: "https://workos-exports.s3.amazonaws.com/..."  # Valid 1 hour
  
# Step 3: Download CSV
curl -o events.csv "<url from step 2>"
```

**Polling strategy:** Check every 5-10 seconds for small exports, 30-60 seconds for large ranges.

## Error Code Mapping

| Status | Cause | Fix |
| ------ | ----- | --- |
| 401 | Missing or invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is from correct environment |
| 403 | API key lacks audit logs permission | Enable Audit Logs in WorkOS Dashboard → API Keys |
| 404 | Export ID not found | Verify export was created for this organization |
| 422 | Invalid event schema | Check `action` format is `{resource}.{action}`, `occurred_at` is ISO8601 |
| 422 | Organization not found | Verify `organization_id` exists and is accessible |
| 422 | Retention period out of range | Check fetched docs for min/max retention days for your plan |
| 429 | Rate limit exceeded | Implement exponential backoff (start at 1s, max 60s) |
| 500 | WorkOS server error | Retry with exponential backoff, contact support if persists |

## Rate Limits

Check fetched documentation for current rate limits. General guidance:
- Event creation: High throughput allowed (thousands/minute typical)
- Export creation: Lower limit (check docs for exact number)
- Retry strategy: Exponential backoff starting at 1s, max 60s between attempts

## Schema Configuration

Define custom event types before emitting events:

```pseudocode
POST /schemas
Body:
  organization_id: "org_12345"
  name: "User Management"
  actions:
    - name: "user.created"
      description: "User account created"
    - name: "user.deleted"
      description: "User account deleted"

Response: 201 with schema object
```

**Best practices:**
- Define schemas during initial setup, not at runtime
- Use consistent naming: `{resource}.{action}` (lowercase, dot-separated)
- One schema per logical domain (e.g., "User Management", "Billing")

## Verification Commands

```bash
# 1. Verify API key authentication
curl https://api.workos.com/audit_logs/schemas \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# 2. Create a test event
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{
    "organization_id": "org_YOUR_ORG_ID",
    "event": {
      "action": "test.verification",
      "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "actor": {"type": "user", "id": "test_user"},
      "targets": [{"type": "resource", "id": "test_resource"}]
    }
  }'

# 3. Check retention policy
curl https://api.workos.com/audit_logs/retention \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Pagination Handling

Schema and action list endpoints support pagination:

```pseudocode
GET /schemas?limit=10&after=cursor_abc123

Response:
  data: [...]
  list_metadata:
    after: "cursor_xyz789"  # Use for next page
    before: "cursor_abc123"
```

Use `after` cursor for forward pagination, `before` for backward.

## Common Integration Patterns

**Real-time event logging:**
```pseudocode
function logAuditEvent(action, actor, target, metadata):
  # Non-blocking - fire and forget
  asyncPost("/events", {
    organization_id: currentOrg.id,
    event: {
      action: action,
      occurred_at: now(),
      actor: actor,
      targets: [target],
      metadata: metadata
    }
  })
```

**Compliance export (monthly):**
```pseudocode
function exportMonthlyLogs(org_id, year, month):
  start = firstDayOfMonth(year, month)
  end = lastDayOfMonth(year, month)
  
  export = post("/exports", {
    organization_id: org_id,
    range_start: start,
    range_end: end
  })
  
  while export.state != "ready":
    sleep(30)
    export = get("/exports/" + export.id)
  
  downloadCSV(export.url, filename)
```

## Dashboard Configuration

Navigate to WorkOS Dashboard:
1. **API Keys** → Verify Audit Logs permission enabled
2. **Audit Logs** → Configure retention policy
3. **Audit Logs** → Define schemas (or use API)

## Related Skills

- `workos-audit-logs-feature` - Feature overview and integration patterns
- `workos-organizations-api` - Managing organizations for audit log scoping
