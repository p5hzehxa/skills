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

_After fetching, you will have:_
- Complete request/response schemas for all endpoints
- Current authentication requirements and headers
- Latest error codes and rate limits
- SDK method signatures for your language

## Prerequisites

Set these environment variables:

```bash
WORKOS_API_KEY=sk_live_...  # Starts with sk_
```

Verify your setup:

```bash
curl https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 OK or 401 if key is invalid.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/audit_logs/events` | Create a single audit log event |
| POST | `/audit_logs/exports` | Create an export job for audit logs |
| GET | `/audit_logs/exports/{export_id}` | Get export job status and download URL |

**Authentication:** All requests require `Authorization: Bearer {WORKOS_API_KEY}` header.

## Operation Decision Tree

### Creating Events

**Use POST `/audit_logs/events` when:**
- Logging user actions in real-time
- You have actor, action, target, and context data
- You want immediate confirmation (synchronous)

**Pattern:**
```
POST /audit_logs/events
{
  "organization_id": "org_...",
  "event": {
    "action": "{domain}.{resource}.{action}",
    "actor": { "type": "user", "id": "user_123" },
    "targets": [{ "type": "document", "id": "doc_456" }],
    "context": { "location": "192.168.1.1" }
  }
}
```

**Event naming convention:** Use `{domain}.{resource}.{action}` format (e.g., `user.session.login`, `document.file.delete`).

### Exporting Events

**Use POST `/audit_logs/exports` when:**
- You need to export logs for compliance audits
- Filtering by date range or actor
- Downloading logs for external processing

**Pattern:**
```
POST /audit_logs/exports
{
  "organization_id": "org_...",
  "range_start": "2024-01-01T00:00:00Z",
  "range_end": "2024-12-31T23:59:59Z"
}

Response: { "id": "audit_log_export_...", "state": "pending" }
```

**Then poll GET `/audit_logs/exports/{export_id}` until `state: "ready"`, then download from `url` field.**

## Error Code Mapping

Fetch latest error codes from documentation. Common patterns:

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Check `WORKOS_API_KEY` starts with `sk_` and is not expired |
| 400 | Malformed event structure | Verify `action`, `actor`, `targets` fields match schema in fetched docs |
| 404 | Export ID not found | Confirm export was created and ID is correct |
| 422 | Invalid organization_id | Check organization exists in WorkOS Dashboard |
| 429 | Rate limit exceeded | Check fetched docs for current rate limits and implement exponential backoff |

**For exact error messages and new error codes, check fetched docs.**

## Pagination Handling

The Events API does NOT support listing — it's create-only. Use Exports API to retrieve historical logs.

**Export results:** Check fetched docs for export file format (CSV/JSON) and structure.

## Rate Limits

Check fetched docs for current rate limits. Typical pattern:

```
If 429 response:
  - Read Retry-After header (seconds to wait)
  - Implement exponential backoff: 1s, 2s, 4s, 8s...
  - Consider batching events if creating many
```

## Runnable Verification

### Test Event Creation

```bash
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_YOUR_ORG_ID",
    "event": {
      "action": "user.login.success",
      "actor": {
        "type": "user",
        "id": "test_user_123",
        "name": "Test User"
      },
      "targets": [{
        "type": "session",
        "id": "session_456"
      }],
      "context": {
        "location": "192.168.1.1",
        "user_agent": "curl/7.64.1"
      },
      "occurred_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"
    }
  }'
```

Expected: `201 Created` with `{ "success": true }` body.

### Test Export Creation

```bash
# Create export
EXPORT_ID=$(curl -X POST https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_YOUR_ORG_ID",
    "range_start": "2024-01-01T00:00:00Z",
    "range_end": "2024-12-31T23:59:59Z"
  }' | jq -r '.id')

echo "Export ID: $EXPORT_ID"

# Poll until ready
while true; do
  STATE=$(curl -s https://api.workos.com/audit_logs/exports/$EXPORT_ID \
    -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.state')
  echo "State: $STATE"
  [ "$STATE" = "ready" ] && break
  sleep 2
done

# Get download URL
curl -s https://api.workos.com/audit_logs/exports/$EXPORT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -r '.url'
```

## Configuration in WorkOS Dashboard

Navigate to **Audit Logs** section in WorkOS Dashboard to:
- View organization-specific audit log streams
- Configure retention policies (check fetched docs for available durations)
- Set up event schemas and validation rules (if supported — verify in fetched docs)

## Common Traps

1. **Event action naming:** Use consistent `{domain}.{resource}.{action}` format. Inconsistent naming breaks filtering and reporting.

2. **occurred_at timestamp:** If omitted, WorkOS uses server receive time. For accurate logs, always send `occurred_at` in ISO 8601 UTC format.

3. **organization_id scope:** Events are scoped to organizations. Cannot query across orgs — you must know the org_id at creation time.

4. **Export polling:** Do NOT poll faster than every 2 seconds. Exports can take 30+ seconds for large date ranges.

5. **Actor vs Target confusion:** Actor = who performed the action. Target = what was affected. A user (actor) deleting a file (target) should have actor.type=user and target.type=file.

## Related Skills

- `workos-feature-audit-logs` — Feature overview and integration patterns
- `workos-feature-admin-portal` — End-user audit log viewing UI
- `workos-feature-organizations` — Organization management context
