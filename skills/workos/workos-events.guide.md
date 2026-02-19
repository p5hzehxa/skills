<!-- refined:sha256:96424db5567d -->

# WorkOS Events — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:
- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before proceeding.

### Project Dependencies

Confirm WorkOS SDK is installed:

```bash
# Check package.json or equivalent for SDK dependency
grep -r "workos" package.json requirements.txt Gemfile go.mod # adjust for language
```

### Event Source Requirements

**CRITICAL:** Events require an active data source. Confirm one of these exists in WorkOS Dashboard:
- SSO connection configured (any provider)
- Directory Sync connection configured

**Without an event source, no events will generate.** Check Dashboard → Connections.

## Step 3: Choose Integration Pattern (Decision Tree)

```
Integration goal?
  |
  +-- Real-time monitoring/alerting? ──> Use Datadog streaming (Step 4)
  |
  +-- Sync data to your database? ──────> Decision point:
                                           |
                                           +-- Need historical replay? ──> Events API (Step 5)
                                           |
                                           +-- Real-time only? ──────────> Webhooks (Step 6)
```

**Can combine multiple patterns.** Datadog + webhooks is common for analytics + data sync.

## Step 4: Datadog Streaming Setup (Optional)

If you chose Datadog integration:

### 4.1: Obtain Datadog API Key

From Datadog console:
- Navigate to Organization Settings → API Keys
- Create new API key or use existing
- Copy key value (starts with a hex string)

### 4.2: Configure in WorkOS Dashboard

1. Go to Dashboard → Events → Integrations
2. Select Datadog
3. Enter Datadog API key
4. Select Datadog site region (e.g., `datadoghq.com`, `datadoghq.eu`)
5. Save configuration

### 4.3: Verify Streaming

**Wait 5-10 minutes** for initial events to flow (WorkOS batches events).

In Datadog, check for `workos.*` event namespace:
- Navigate to Logs or Events Explorer
- Filter by source:`workos`
- Confirm events appear

**If no events after 15 minutes:**
- Check: API key is correct and has write permissions
- Check: Site region matches your Datadog instance
- Check: An event source exists (SSO/Directory connection)

## Step 5: Events API Integration (Optional)

If you chose Events API (historical replay, pagination, filtering):

### 5.1: API Structure

Check fetched docs for exact endpoint and parameters. Pattern:

```
GET /events
Query params: after (cursor), limit, event types filter
Response: { data: [...events], list_metadata: { after: "cursor" } }
```

### 5.2: Pagination Pattern

Use cursor-based pagination:

```
Pseudocode:
  cursor = null
  loop:
    response = fetch_events(after=cursor, limit=100)
    process(response.data)
    cursor = response.list_metadata.after
    if cursor is null: break
```

**Do NOT use offset-based pagination** — cursors ensure consistency during sync.

### 5.3: Event Type Filtering

Check fetched docs for available event types. Format: `{domain}.{resource}.{action}`

Examples:
- `dsync.user.created`
- `authentication.email_verification_succeeded`
- `connection.activated`

Filter by passing `events[]` query param (check docs for exact syntax).

### 5.4: Deduplication Strategy

Events have unique `id` field. Use upsert pattern:

```
Pseudocode:
  for event in response.data:
    upsert_to_db(key=event.id, data=event)
```

**CRITICAL:** The `id` field is immutable and globally unique. Use it as primary key.

## Step 6: Webhook Integration (Optional)

If you chose webhooks (real-time push):

### 6.1: Create Endpoint

Create HTTP endpoint at your chosen path (e.g., `/webhooks/workos`).

**Endpoint requirements:**
- Accept POST requests
- Parse JSON request body
- Return HTTP 200 immediately (do not wait for processing)
- Process event asynchronously after responding

**Pattern:**

```
Pseudocode:
  POST /webhooks/workos:
    1. Validate signature (Step 6.3)
    2. Respond HTTP 200 immediately
    3. Queue event for async processing
    4. Return
```

**Why respond immediately:** WorkOS retries failed deliveries. If you process synchronously and it takes >30s, you'll get duplicate events.

### 6.2: Register Endpoint in Dashboard

1. Go to Dashboard → Webhooks
2. Click "Add Endpoint"
3. Enter your endpoint URL (must be HTTPS in production)
4. Select event types to receive (or "all events")
5. Save and copy the webhook secret (shown once)

**Store webhook secret securely** as environment variable: `WORKOS_WEBHOOK_SECRET`

### 6.3: Signature Validation

**CRITICAL:** Validate signature before processing. Prevents replay attacks and unauthorized requests.

#### Option A: Use SDK Method

Check fetched docs for exact SDK method signature. Pattern:

```
Pseudocode (varies by language):
  raw_body = request.get_raw_body()  # NOT parsed JSON
  signature_header = request.headers['WorkOS-Signature']
  
  sdk.webhooks.verify_signature(
    payload=raw_body,
    signature=signature_header,
    secret=WORKOS_WEBHOOK_SECRET,
    tolerance=300  # 5 minutes
  )
```

**If validation fails:** Reject with HTTP 400. Do NOT process event.

**Common mistake:** Parsing body as JSON before validation. SDK needs raw bytes.

#### Option B: Manual Validation

If implementing yourself:

1. Parse `WorkOS-Signature` header:
   - Format: `t=<timestamp>,v1=<signature>`
   - Extract timestamp (milliseconds since epoch)
   - Extract signature hash

2. Validate timestamp freshness:
   ```
   current_time = now_in_milliseconds()
   if abs(current_time - timestamp) > 300000:  # 5 min tolerance
     reject_request()
   ```

3. Compute expected signature:
   ```
   message = timestamp + "." + raw_body
   expected = hmac_sha256(WORKOS_WEBHOOK_SECRET, message)
   ```

4. Compare signatures (constant-time comparison):
   ```
   if not constant_time_compare(expected, signature):
     reject_request()
   ```

**Use constant-time comparison** to prevent timing attacks.

### 6.4: IP Allowlist (Recommended)

Restrict endpoint to WorkOS IPs:

```
WorkOS IP addresses:
  3.217.146.166
  44.209.16.206
  54.205.205.43
```

Add firewall rules or application-level checks to reject requests from other IPs.

### 6.5: Retry Behavior

**WorkOS retry policy:**
- Failed deliveries (non-200 response) retry up to 6 times
- Exponential backoff over 3 days
- Events are not deduplicated during retries

**Implication:** Your handler MUST be idempotent. Check event `id` exists before creating database records.

### 6.6: Event Processing Pattern

**Recommended architecture:**

```
Webhook endpoint:
  1. Validate signature
  2. Respond HTTP 200
  3. Enqueue event to job queue (Redis, SQS, etc.)
  
Background worker:
  1. Dequeue event
  2. Check if event.id already processed (idempotency)
  3. Process event (update database, trigger actions)
  4. Mark event.id as processed
```

**Why async processing:** Prevents timeouts, handles spikes, enables retries on your side.

## Step 7: Event Structure

All events share common fields. Check fetched docs for complete schema. Key fields:

- `id` - Unique event identifier (use for deduplication)
- `event` - Event type string (`{domain}.{resource}.{action}`)
- `created_at` - ISO8601 timestamp
- `data` - Event payload (varies by event type)

**Event type namespaces:**
- `authentication.*` - Sign-in, verification, password events
- `connection.*` - SSO connection lifecycle
- `dsync.*` - Directory sync events (user/group CRUD)
- `organization.*` - Organization changes
- `session.*` - Session lifecycle events

**Check fetched docs** for complete event type catalog and payload schemas.

## Step 8: Data Reconciliation

**Why reconciliation matters:** Webhooks can be missed (endpoint downtime, network issues). Reconcile periodically.

### Reconciliation Strategy

Hybrid approach combining webhooks + Events API:

```
Pseudocode:
  # Real-time: Process webhooks as they arrive
  
  # Periodic reconciliation (every 6-24 hours):
  last_sync_cursor = load_from_db()
  cursor = last_sync_cursor
  
  loop:
    response = fetch_events_api(after=cursor)
    for event in response.data:
      if not exists_in_db(event.id):
        process_event(event)  # Missed by webhook
    cursor = response.list_metadata.after
    save_cursor_to_db(cursor)
    if cursor is null: break
```

**Store cursor persistently** (database, not in-memory). Enables resume after crashes.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Check environment variables exist
env | grep -E 'WORKOS_(API_KEY|CLIENT_ID|WEBHOOK_SECRET)'

# 2. Verify SDK is installed
# (adjust for your language/package manager)
npm list @workos-inc/node || pip show workos || gem list workos

# 3. For Datadog: Check events appear in Datadog
# (manual check in Datadog console after 15 min)

# 4. For webhooks: Test endpoint signature validation
curl -X POST http://localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" \
  -H "WorkOS-Signature: t=invalid,v1=invalid" \
  -d '{"event":"test"}' \
# Expected: HTTP 400 or 401 (signature validation failed)

# 5. For webhooks: Check endpoint responds quickly
time curl -X POST http://localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" \
  -H "WorkOS-Signature: t=$(date +%s)000,v1=test" \
  -d '{"event":"test"}'
# Expected: Response in <1 second (proves you return 200 immediately)

# 6. For Events API: Fetch events successfully
# (use your SDK or curl with API key)
curl "https://api.workos.com/events?limit=1" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
# Expected: HTTP 200 with event array
```

**All checks must pass** before marking integration complete.

## Error Recovery

### "No events appearing in Datadog/webhook"

**Root cause:** No event source exists.

Fix:
1. Go to WorkOS Dashboard → Connections
2. Confirm at least one SSO or Directory Sync connection is active
3. Trigger an event (e.g., sign in via SSO)
4. Wait 5-10 minutes for event to flow

### "Webhook signature validation fails"

**Root causes:**
1. **Wrong secret** - Using API key instead of webhook secret
   - Fix: Use secret from Dashboard → Webhooks → [your endpoint] → Secret
2. **Body already parsed** - SDK received parsed JSON instead of raw bytes
   - Fix: Get raw request body before parsing, pass to SDK
3. **Clock skew** - Server time differs from WorkOS by >5 minutes
   - Fix: Sync server clock with NTP

### "Events API returns 401 Unauthorized"

**Root cause:** Invalid or missing API key.

Fix:
- Check `WORKOS_API_KEY` starts with `sk_`
- Verify key exists in Dashboard → API Keys
- Confirm key has not been deleted/rotated

### "Webhook receiving duplicate events"

**Root cause:** Endpoint not responding with HTTP 200, triggering retries.

Fix:
1. Check endpoint logs for errors/timeouts
2. Ensure HTTP 200 returned BEFORE processing (Step 6.4 pattern)
3. Add idempotency checks using event `id` field

### "Events API pagination cursor expired"

**Root cause:** Cursor held for >7 days (cursors expire).

Fix:
- Restart pagination from beginning (no cursor)
- Implement reconciliation more frequently (<7 days)

### "Missing events during reconciliation"

**Root cause:** Not all event types selected in webhook configuration.

Fix:
1. Go to Dashboard → Webhooks → [your endpoint]
2. Select "All events" or add missing event types
3. Run reconciliation to catch missed events

## Related Skills

- workos-authkit-nextjs - For handling authentication events in Next.js apps
- workos-authkit-react - For client-side authentication state that generates events
