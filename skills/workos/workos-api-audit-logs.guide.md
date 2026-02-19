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

- WorkOS API key starting with `sk_` (set as `WORKOS_API_KEY`)
- Organization ID from WorkOS Dashboard (format: `org_xxxxx`)
- WorkOS SDK installed (or use direct REST calls)

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/events` | Create a single audit log event |
| POST | `/audit_logs/exports` | Create an export of audit log events |
| GET | `/audit_logs/exports/:id` | Retrieve a specific export |

## Authentication Setup

All requests require the `Authorization` header with your API key:

```bash
Authorization: Bearer sk_your_api_key
```

Environment variable setup:

```bash
export WORKOS_API_KEY="sk_your_api_key"
```

## Operation Decision Tree

### When to use each endpoint:

**Creating audit events:**
- Use `POST /events` for real-time event logging
- Call immediately after the action occurs in your application
- Events appear in Admin Portal within seconds

**Exporting historical data:**
- Use `POST /audit_logs/exports` to generate CSV/JSON exports
- Use `GET /audit_logs/exports/:id` to check export status and download
- Exports are for compliance, backup, or analysis—not real-time monitoring

### Event type naming convention:

Format: `{domain}.{resource}.{action}`

Examples:
- `user.created`
- `document.updated`
- `role.deleted`
- `settings.password_changed`

Check fetched docs for required vs optional event fields.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 403 | API key lacks permission | Check key has Audit Logs write permission in Dashboard → API Keys |
| 422 | Invalid event structure | Check `occurred_at` is ISO 8601, `action` follows naming convention, `organization_id` exists |
| 429 | Rate limit exceeded | Implement exponential backoff (see Rate Limits below) |
| 500 | WorkOS internal error | Retry with exponential backoff; check WorkOS status page |

### Event creation specific errors:

**422 with "occurred_at is invalid":**
- Cause: Timestamp not in ISO 8601 format or too far in past/future
- Fix: Use `new Date().toISOString()` or ensure UTC format `2024-01-15T10:30:00Z`

**422 with "organization_id not found":**
- Cause: Org ID doesn't exist or typo
- Fix: Verify org ID in Dashboard → Organizations (format: `org_xxxxx`)

**422 with "actor is required":**
- Cause: Missing actor object in event payload
- Fix: Include `actor: { id, type, name }` in event body

## Pagination Handling

Exports API does not paginate individual export objects. However, exported CSV/JSON files may contain paginated event data. Check fetched docs for:
- Maximum events per export
- Date range filtering options
- Cursor-based continuation if export exceeds limit

## Rate Limits

Check fetched docs for current rate limits. General pattern:

**Event creation:**
- Implement exponential backoff on 429 responses
- Start with 1s delay, double on each retry, cap at 32s
- Log dropped events to dead letter queue for replay

Pseudocode pattern:
```
retry_delay = 1
max_retries = 5

for attempt in 1..max_retries:
  response = POST /events
  if response.status == 429:
    sleep(retry_delay)
    retry_delay = min(retry_delay * 2, 32)
    continue
  else:
    break
```

## Runnable Verification

### Verify API key works:

```bash
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_your_org_id",
    "event": {
      "action": "user.login_succeeded",
      "occurred_at": "2024-01-15T10:30:00Z",
      "actor": {
        "id": "user_123",
        "type": "user",
        "name": "Test User"
      },
      "targets": [{
        "id": "session_456",
        "type": "session"
      }],
      "context": {
        "location": "192.168.1.1",
        "user_agent": "Mozilla/5.0"
      }
    }
  }'
```

Expected response: `201 Created` with event object

### Verify event appears in Admin Portal:

1. Navigate to WorkOS Dashboard → Audit Logs
2. Select your organization
3. Find event with action `user.login_succeeded`
4. Verify timestamp, actor, and metadata match

### Create and retrieve an export:

```bash
# Create export
export_id=$(curl -X POST https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_your_org_id",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-01-31T23:59:59Z"
  }' | jq -r '.id')

# Check export status
curl https://api.workos.com/audit_logs/exports/$export_id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Check fetched docs for export `state` values (`pending`, `ready`, `error`) and download URL location.

## Integration Patterns

### Pattern 1: Synchronous event logging

Call `POST /events` immediately after action completes:

```
# After user creation
user = create_user(email, password)

POST /events {
  organization_id: user.organization_id,
  event: {
    action: "user.created",
    occurred_at: NOW(),
    actor: CURRENT_USER,
    targets: [{ id: user.id, type: "user" }]
  }
}
```

**Trap:** Do NOT block user-facing responses on audit log API calls. Use async/background jobs for non-critical events.

### Pattern 2: Async event queue

For high-volume operations, queue events and batch send:

```
# Immediate response
action_result = perform_action()
event_queue.push(build_event(action_result))
return success_response

# Background worker
batch = event_queue.pop(100)
for event in batch:
  POST /events (event)
  # Handle failures with retry/DLQ
```

### Pattern 3: Export scheduling

Generate monthly compliance reports:

```
# Cron job: 1st of each month
range_start = first_day_of_previous_month()
range_end = last_day_of_previous_month()

export = POST /audit_logs/exports {
  organization_id,
  range_start,
  range_end
}

# Poll until ready (with timeout)
while export.state == "pending":
  sleep(5)
  export = GET /audit_logs/exports/:id

if export.state == "ready":
  download(export.url)
  archive_to_s3(export.url)
```

## Dashboard Configuration

Navigate to WorkOS Dashboard → Audit Logs:

1. **Enable Audit Logs** for your environment
2. **Configure retention period** (check fetched docs for available options)
3. **Set up Admin Portal access** for end-user log viewing
4. **Optional: Configure event schemas** for custom metadata validation

Retention setting affects how long events remain queryable via Admin Portal—does NOT affect export availability. Check fetched docs for retention vs export data lifecycle.

## Common Pitfalls

### Issue: Events created but not visible in Admin Portal

**Cause 1:** Wrong organization ID
- Fix: Verify `organization_id` matches Dashboard → Organizations

**Cause 2:** Admin Portal not configured for org
- Fix: Dashboard → Admin Portal → Enable for organization

**Cause 3:** Time sync issues
- Fix: Use server-side timestamps, not client-side; ensure UTC

### Issue: Export stays in "pending" state

**Cause 1:** Date range too large
- Fix: Check fetched docs for maximum export window; split into smaller ranges

**Cause 2:** No events in range
- Fix: Verify events exist with matching organization_id and timestamp range

### Issue: Missing event metadata in Admin Portal

**Cause:** Optional fields omitted
- Fix: Include `context`, `targets`, and custom metadata for rich audit trails

## Testing Checklist

- [ ] API key authentication succeeds (201 response from `POST /events`)
- [ ] Event appears in Admin Portal within 10 seconds
- [ ] Event timestamp matches `occurred_at` value (accounting for timezone)
- [ ] Actor name and ID display correctly in portal
- [ ] Target resources linked correctly
- [ ] Export creation returns export ID
- [ ] Export reaches "ready" state within expected time
- [ ] Download URL returns valid CSV/JSON
- [ ] Rate limit handling triggers on rapid requests (if testing at scale)
- [ ] 422 errors return actionable messages

## Related Skills

- workos-feature-audit-logs (feature overview and Admin Portal setup)
