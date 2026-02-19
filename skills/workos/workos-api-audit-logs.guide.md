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

Check fetched docs for complete request/response schemas, error codes, and rate limits.

## Prerequisites

Set these environment variables before making API calls:

```bash
export WORKOS_API_KEY=sk_live_xxxxx  # Must start with sk_
export WORKOS_CLIENT_ID=client_xxxxx
```

Verify credentials work:

```bash
curl https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

If you get 401 Unauthorized, regenerate your API key in WorkOS Dashboard → API Keys.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/audit_logs/events` | Create a single audit log event |
| POST | `/audit_logs/exports` | Request a CSV export of events |
| GET | `/audit_logs/exports/:export_id` | Check export status and download URL |

All endpoints require Bearer token authentication using your WorkOS API key.

## Authentication Setup

Include your API key in every request:

```
Authorization: Bearer sk_live_xxxxx
```

The key must have "Audit Logs" scope enabled in the WorkOS Dashboard. Check Dashboard → API Keys → [Your Key] → Scopes if you get 403 Forbidden.

## Operation Decision Tree

**Creating events:**
- Use `POST /audit_logs/events` for immediate event ingestion
- Events process asynchronously — 202 response means accepted, not stored
- No batch endpoint — send one event per request (parallelize client-side if needed)

**Exporting events:**
- Use `POST /audit_logs/exports` to start export job
- Use `GET /audit_logs/exports/:export_id` to poll for completion
- Export generates CSV, not JSON — parse accordingly

**No list/search endpoint exists** — use exports for bulk retrieval or query via Dashboard.

## Event Creation Pattern

### Minimum Required Fields

Check fetched docs for complete schema. Core pattern:

```
POST /audit_logs/events
{
  "organization_id": "org_xxxxx",
  "event": {
    "action": "user.signed_in",
    "actor_name": "user@example.com",
    "actor_type": "user",
    "occurred_at": "2025-01-15T10:30:00Z"
  }
}
```

### Event Type Naming Convention

Follow `{domain}.{resource}.{action}` pattern:
- ✅ `user.profile.updated`
- ✅ `document.access.granted`
- ❌ `userUpdated` (no convention)
- ❌ `user_updated` (underscores, not dots)

### Actor Types

Check fetched docs for complete list. Common values:
- `user` — end user action
- `system` — automated process
- `api` — API client action

### Timestamp Requirements

`occurred_at` uses ISO 8601 format. If omitted, WorkOS uses current server time.

For backdating events, check fetched docs for retention limits.

## Export Pattern

### Step 1: Request Export

```
POST /audit_logs/exports
{
  "organization_id": "org_xxxxx",
  "range_start": "2025-01-01T00:00:00Z",
  "range_end": "2025-01-31T23:59:59Z"
}
```

Response includes `export_id`:

```json
{
  "id": "audit_log_export_xxxxx",
  "state": "pending"
}
```

### Step 2: Poll for Completion

```
GET /audit_logs/exports/audit_log_export_xxxxx
```

When `state` changes to `ready`, response includes `url` field:

```json
{
  "id": "audit_log_export_xxxxx",
  "state": "ready",
  "url": "https://workos-exports.s3.amazonaws.com/xxxxx"
}
```

### Step 3: Download CSV

```bash
curl -o events.csv "https://workos-exports.s3.amazonaws.com/xxxxx"
```

Export URLs expire after 1 hour — download immediately when ready.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Check `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 403 | API key lacks Audit Logs scope | Enable scope in Dashboard → API Keys → [Your Key] → Scopes |
| 404 | Export ID doesn't exist | Verify `export_id` from create response, check for typos |
| 422 | Invalid event schema | Check `organization_id` format, `occurred_at` is valid ISO 8601, `action` follows naming convention |
| 429 | Rate limit exceeded | Implement exponential backoff, check fetched docs for current limits |
| 500 | WorkOS server error | Retry with exponential backoff (not your fault) |

For 422 errors, response body includes field-specific validation messages — check `message` field.

## Pagination Handling

Event creation endpoint does NOT paginate (single event per request).

Export endpoint does NOT paginate (generates complete CSV).

No list endpoint exists for real-time querying.

## Rate Limit Guidance

Check fetched docs for current rate limits per endpoint.

When you hit 429, implement exponential backoff:

```
attempt 1: wait 1 second
attempt 2: wait 2 seconds
attempt 3: wait 4 seconds
attempt 4: wait 8 seconds
max: wait 30 seconds
```

If still failing after 5 retries, the issue is NOT rate limiting — check for API key or schema errors.

## Verification Commands

### Test event creation:

```bash
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5K8PQ3G2CQF6TREP3TZKZ9Q",
    "event": {
      "action": "test.verification.created",
      "actor_name": "test@example.com",
      "actor_type": "user",
      "occurred_at": "2025-01-15T10:30:00Z"
    }
  }'
```

Expect 202 Accepted response. Check Dashboard → Audit Logs → [Your Org] to verify event appears.

### Test export creation:

```bash
curl -X POST https://api.workos.com/audit_logs/exports \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H5K8PQ3G2CQF6TREP3TZKZ9Q",
    "range_start": "2025-01-01T00:00:00Z",
    "range_end": "2025-01-15T23:59:59Z"
  }'
```

Expect 201 Created with `export_id` in response.

### Test export retrieval:

```bash
export EXPORT_ID=audit_log_export_xxxxx  # From create response
curl https://api.workos.com/audit_logs/exports/$EXPORT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expect `state: pending` initially, then `state: ready` with `url` field after processing (usually < 30 seconds for small exports).

## Common Integration Traps

### Trap 1: Treating 202 as confirmation
✅ Event creation returns 202 immediately — this means "accepted for processing", NOT "stored successfully"  
❌ Don't wait for synchronous confirmation — events process asynchronously  
**Fix:** Log event creation locally if you need confirmation tracking

### Trap 2: Polling exports too aggressively
✅ Poll every 5-10 seconds for export completion  
❌ Polling every second wastes rate limit quota  
**Fix:** Implement exponential backoff or use webhook (check fetched docs for webhook availability)

### Trap 3: Forgetting URL expiration
✅ Export URLs expire after 1 hour  
❌ Storing URLs for later download fails silently  
**Fix:** Download CSV immediately when `state: ready`, or request new export

### Trap 4: Inconsistent event naming
✅ Use `user.profile.updated` consistently across your app  
❌ Mixing `userProfileUpdated`, `user_profile_updated` breaks Dashboard filtering  
**Fix:** Define event taxonomy document before implementation

### Trap 5: Missing organization context
✅ Every event needs `organization_id` from your DB  
❌ Hardcoding a test org ID in production  
**Fix:** Pass org ID from authenticated user session or tenant context

## Related Skills

- workos-audit-logs — feature overview and dashboard configuration (read this first for conceptual understanding)
