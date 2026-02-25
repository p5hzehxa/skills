<!-- refined:sha256:106ca62de786 -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs (source of truth):

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Choose Data Sync Strategy (Decision Tree)

```
What is your use case?
  |
  +-- Real-time observability dashboard → Datadog integration (Step 3)
  |
  +-- Sync events to your database → Which pattern?
        |
        +-- Push-based (WorkOS notifies you) → Webhooks (Step 4)
        |
        +-- Pull-based (you poll WorkOS) → Events API (Step 5)
        |
        +-- Backfill or reconciliation → Events API with pagination (Step 6)
```

**Choose ONE approach.** Do not implement both webhooks and Events API polling simultaneously — this causes duplicate event processing.

## Step 3: Datadog Integration

Dashboard navigation: WorkOS Dashboard → Integrations → Datadog

**Prerequisite:** Active Datadog account with API key.

Check fetched docs for:

- Datadog API key configuration
- Available dashboard templates
- Event type filtering options

**Verification:**

```bash
# Check events appearing in Datadog (replace with your Datadog site)
curl -X GET "https://api.datadoghq.com/api/v1/events" \
  -H "DD-API-KEY: ${DD_API_KEY}" | grep "workos"
```

## Step 4: Webhook Implementation

### 4.1 Create Webhook Endpoint

Endpoint requirements:

- Returns `200 OK` within 5 seconds (acknowledge immediately, process async)
- Verifies signature before processing (prevents replay attacks)
- Handles duplicate events idempotently (WorkOS may retry)

**Example endpoint structure (language-agnostic):**

```
POST /webhooks/workos

1. Extract signature from headers
2. Verify signature using webhook secret
   → SDK method: verifyWebhookSignature(payload, signature, secret)
3. Return 200 immediately
4. Queue event for async processing
5. Process event with idempotency check
```

Check fetched docs for exact signature verification method in your SDK.

### 4.2 Register Endpoint

Dashboard navigation: WorkOS Dashboard → Webhooks → Add endpoint

**Required fields:**

- Endpoint URL (must be publicly accessible HTTPS)
- Event types to subscribe to (see Step 4.3)

**Webhook secret:** Save this value to env vars as `WORKOS_WEBHOOK_SECRET`. It is shown only once.

### 4.3 Event Type Selection (Decision Tree)

```
Which events do you need?
  |
  +-- User auth activity → dsync.user.created, dsync.user.updated
  |
  +-- SSO connection changes → connection.activated, connection.deactivated
  |
  +-- Directory sync updates → dsync.group.user_added, dsync.group.user_removed
  |
  +-- All events → Subscribe to wildcard (check docs for pattern)
```

Check fetched docs for complete event type list and naming conventions.

## Step 5: Events API Polling

Use when webhooks are not feasible (firewall restrictions, local dev, etc.).

**Polling pattern:**

```
1. Store last_event_id in database
2. Call SDK method for listing events:
   → workos.events.list(after: last_event_id, limit: 100)
3. Process events
4. Update last_event_id to newest event
5. Sleep interval (recommended: 30-60 seconds)
```

**CRITICAL:** Store `last_event_id` persistently. If lost, you must backfill (Step 6).

Check fetched docs for exact API pagination parameters and rate limits.

## Step 6: Data Reconciliation

**Use when:**

- Initial sync of historical events
- Webhook endpoint was down
- Detected missing events (gap in sequence)

**Backfill pattern:**

```
1. Determine time range to backfill
2. Use Events API with date filters:
   → workos.events.list(created_after: timestamp, created_before: timestamp)
3. Paginate through all results (check docs for cursor pattern)
4. Upsert events by event.id (prevents duplicates)
```

**Trap warning:** Do NOT backfill by replaying webhooks. Webhook signatures expire. Always use Events API for historical data.

## Verification Checklist (ALL MUST PASS)

**For Webhook Implementation:**

```bash
# 1. Endpoint returns 200 (replace URL)
curl -X POST https://your-app.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' -w "\nHTTP: %{http_code}\n"

# 2. Signature verification exists in code
grep -r "verifyWebhookSignature\|verify.*signature" src/ || echo "FAIL: No signature verification"

# 3. Webhook secret configured
echo $WORKOS_WEBHOOK_SECRET | grep -q '^wh_' && echo "✓ valid" || echo "✗ missing or invalid"

# 4. Endpoint registered in dashboard
# Manual check: WorkOS Dashboard → Webhooks → endpoint URL listed
```

**For Events API Polling:**

```bash
# 1. SDK method call exists
grep -r "events\.list\|listEvents" src/ || echo "FAIL: No Events API implementation"

# 2. last_event_id storage exists (check your DB schema)
# DB-specific check — replace with your query tool
psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='sync_state' AND column_name='last_event_id';"
```

## Error Recovery

### Webhook: "Signature verification failed"

**Root cause:** Signature computed with wrong secret or payload was modified.

Fix checklist:

1. Confirm `WORKOS_WEBHOOK_SECRET` matches Dashboard value (rotate if leaked)
2. Verify raw request body used for signature (no JSON parsing before verification)
3. Check SDK version supports your WorkOS webhook version (check docs for breaking changes)

**Test signature verification:**

```bash
# Use WorkOS Dashboard "Send test event" button
# Check logs for verification result before 200 response
```

### Events API: "Rate limit exceeded"

**Root cause:** Polling too frequently or large backfill batch.

Fix: Implement exponential backoff. Check fetched docs for current rate limits.

### Events API: "Missing events in sequence"

**Root cause:** `last_event_id` lost or polling interval too long.

Fix: Run data reconciliation (Step 6) for the gap period. Check application logs for when `last_event_id` was last updated.

### Duplicate Events Processing

**Root cause:** Both webhooks and Events API polling active, or webhook retries without idempotency.

Fix pattern:

```
1. Check event.id exists in database before processing
2. If exists: skip processing, return success
3. If new: process and store event.id
```

**Critical:** Use event.id (unique per event), not webhook delivery ID.

## Related Skills

- workos-authkit-nextjs (generates auth events)
- workos-authkit-react (generates auth events)
