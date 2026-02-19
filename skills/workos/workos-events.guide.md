<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

These docs are the source of truth. If this skill conflicts with them, follow the docs.

## Step 2: Pre-Flight Validation

### Project Setup

- Confirm WorkOS SDK installed in project
- Confirm `.env` or equivalent contains `WORKOS_API_KEY` (starts with `sk_`)
- Confirm at least one SSO connection or Directory Sync connection exists in WorkOS Dashboard (events require existing connections to trigger)

**Verify:** No events will fire without an active connection. Check Dashboard → Connections before continuing.

## Step 3: Data Syncing Strategy (Decision Tree)

WorkOS Events supports two consumption patterns. Choose based on your architecture:

```
How will you consume events?
  |
  +-- Real-time processing needed?
  |     |
  |     +-- YES --> Webhooks (Step 4)
  |     |
  |     +-- NO  --> Events API polling (Step 5)
  |
  +-- Observability/analytics only?
        |
        +-- YES --> Datadog streaming (Step 6)
```

**Critical:** You can use multiple patterns simultaneously (e.g., webhooks for real-time + Datadog for observability).

## Step 4: Webhook Integration

### A. Create Webhook Endpoint

Implement HTTP handler that:
1. Returns `200 OK` immediately (within request timeout)
2. Defers event processing to background job/queue
3. Does NOT wait for processing completion before responding

**Trap:** Do NOT return 200 only after processing completes. WorkOS will retry failed deliveries up to 6 times over 3 days. Return 200 to acknowledge receipt, then process asynchronously.

Endpoint pseudocode:
```
POST /webhooks/workos
  |
  +-- Validate signature (Step 4B)
  |
  +-- Queue event for processing
  |
  +-- Return 200 OK (do NOT wait for queue processing)
```

### B. Signature Validation (REQUIRED)

**CRITICAL:** Always validate `WorkOS-Signature` header before processing payload. Prevents replay attacks and unauthorized requests.

#### Option 1: SDK Validation (Recommended)

Use SDK method for webhook validation. Check fetched docs for exact signature:
- Language-specific method name (e.g., `verifyWebhook`, `validateWebhook`)
- Parameters: raw request body, `WorkOS-Signature` header value, webhook secret
- Optional tolerance parameter (default 3-5 minutes)

#### Option 2: Manual Validation

If SDK unavailable, parse header and validate manually:

1. **Parse header:** Extract `t=` (issued timestamp in milliseconds) and `v1=` (HMAC-SHA256 signature)
2. **Validate timestamp:** Check `issued_timestamp` is within acceptable window (recommend 5 minutes)
3. **Compute expected signature:** Check fetched docs for exact signing format and concatenation rules
4. **Compare signatures:** Use constant-time comparison to prevent timing attacks

**Verification command:**
```bash
# Test validation rejects invalid signatures
curl -X POST https://your-app.com/webhooks/workos \
  -H "WorkOS-Signature: t=invalid,v1=invalid" \
  -d '{}' | grep -q "401\|403"
```

### C. Register Endpoint with WorkOS

Dashboard → Webhooks → Add endpoint:
- Enter endpoint URL (must be HTTPS in production)
- Copy webhook secret (store as `WORKOS_WEBHOOK_SECRET` env var)
- Select event types to receive (or subscribe to all)

**Security:** Restrict endpoint access to WorkOS IPs (see Step 7).

### D. Event Processing Pattern

**CRITICAL:** Process events idempotently. WorkOS may deliver the same event multiple times (retries, network issues).

Idempotency strategy:
```
On receiving event:
  |
  +-- Check: Event ID already processed? (query DB)
  |     |
  |     +-- YES --> Return 200 (duplicate delivery)
  |     |
  |     +-- NO  --> Continue
  |
  +-- Store event ID in processed events table
  |
  +-- Process event logic
  |
  +-- Return 200
```

Check fetched docs for event type naming convention (`{domain}.{resource}.{action}`) and available event types.

## Step 5: Events API Polling

Alternative to webhooks for batch processing or polling-based architectures.

### Polling Implementation

Use SDK method for listing events. Check fetched docs for:
- Pagination parameters
- Filtering by event type or date range
- Rate limits

**Pattern:**
```
Every N minutes:
  |
  +-- Fetch events since last poll (use timestamp cursor)
  |
  +-- Process events idempotently (same as Step 4D)
  |
  +-- Update cursor to most recent event timestamp
```

**Trap:** Events API is eventually consistent. Recent events may not appear immediately. For real-time needs, use webhooks.

**Verification command:**
```bash
# Test API returns events (replace with SDK-specific command)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?limit=10"
```

## Step 6: Datadog Streaming (Observability)

Optional: Stream events to Datadog for analytics and alerting.

### Setup

1. Dashboard → Integrations → Datadog
2. Enter Datadog API key
3. Select event types to stream
4. Configure Datadog dashboard with WorkOS metrics

**Use cases:**
- Monitor SSO connection health
- Alert on spike in failed auth attempts
- Track user growth per organization
- Debug customer-reported auth issues

Check fetched docs for complete list of metrics and dashboard templates.

**Verification:** After setup, check Datadog logs for WorkOS events within 5 minutes.

## Step 7: IP Allowlist (Security)

**CRITICAL:** Restrict webhook endpoint to WorkOS IPs only. Prevents unauthorized POST requests.

WorkOS webhook source IPs:
```
3.217.146.166
(check fetched docs for complete list)
```

**Implementation patterns:**
- Cloud Load Balancer: Configure IP allowlist in LB rules
- API Gateway: Add IP restriction policy
- Application firewall: Block non-WorkOS IPs at network layer
- Reverse proxy: Configure nginx/Apache IP restrictions

**Do NOT rely on signature validation alone** — combine with IP allowlist for defense in depth.

## Step 8: Data Reconciliation

Events are eventually consistent. For critical data (user records, organization state), reconcile periodically.

**Reconciliation strategy:**
```
Daily/hourly batch job:
  |
  +-- Query WorkOS API for source-of-truth data (Directory, User, etc.)
  |
  +-- Compare with local database
  |
  +-- Identify discrepancies (missed events, out-of-order delivery)
  |
  +-- Update local state to match WorkOS
```

Check fetched docs for reconciliation API endpoints per resource type (Directory Sync, User Management, etc.).

**Trap:** Do NOT use events as the sole source of truth. Events may arrive out of order or be missed during downtime. Reconciliation ensures consistency.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Webhook endpoint responds with 200
curl -X POST https://your-app.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' -w "%{http_code}" | grep -q "200"

# 2. Invalid signature rejected (should return 401 or 403)
curl -X POST https://your-app.com/webhooks/workos \
  -H "WorkOS-Signature: t=0,v1=invalid" \
  -d '{}' -w "%{http_code}" | grep -qE "401|403"

# 3. Webhook secret configured
test -n "$WORKOS_WEBHOOK_SECRET" || echo "FAIL: WORKOS_WEBHOOK_SECRET not set"

# 4. Events API accessible (replace with SDK-specific command)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?limit=1" -w "%{http_code}" | grep -q "200"

# 5. IP allowlist configured (if applicable)
# Manual check: Verify firewall/LB rules allow only WorkOS IPs
```

**If check #3 fails:** Go back to Step 4C and copy webhook secret from Dashboard.

## Error Recovery

### "Webhook delivery failed" (Dashboard shows retries)

**Root cause:** Endpoint not returning 200 OK within timeout, or returning error status.

Fix:
1. Check endpoint logs for exceptions during request processing
2. Confirm handler returns 200 BEFORE processing completes (queue events, don't wait)
3. Verify endpoint URL is correct and HTTPS
4. Check server has valid SSL certificate

### "Signature validation failed"

**Root cause:** Mismatched webhook secret or incorrect validation implementation.

Fix:
1. Verify `WORKOS_WEBHOOK_SECRET` matches value in Dashboard
2. Ensure using raw request body (not parsed JSON) for signature computation
3. Check SDK version supports signature validation
4. Confirm header parsing extracts both `t=` and `v1=` values correctly

### "Duplicate events processed"

**Root cause:** Missing idempotency checks.

Fix:
1. Add event ID tracking (database table or cache)
2. Query for event ID before processing
3. Skip processing if ID exists, still return 200

### "Events missing from API response"

**Root cause:** Events API is eventually consistent, or pagination cursor incorrect.

Fix:
1. Wait 1-2 minutes for recent events to appear
2. Verify timestamp cursor uses correct format (check fetched docs)
3. For critical workflows, use webhooks instead of polling

### "Connection required to generate events"

**Root cause:** No active SSO or Directory Sync connections in WorkOS Dashboard.

Fix:
1. Dashboard → Connections → Create test connection
2. Trigger test event (e.g., SSO login, directory sync)
3. Verify event appears in webhook endpoint or Events API

### Events arriving out of order

**Expected behavior:** Events may not arrive in chronological order due to network conditions and retry logic.

Fix: Implement event ordering logic based on event timestamp, not arrival time. For critical state updates, use reconciliation (Step 8) to correct eventual inconsistencies.

## Related Skills

- workos-authkit-nextjs — Integrate SSO auth that generates events
- workos-authkit-react — Client-side auth implementation with event generation
