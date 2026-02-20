<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Choose Integration Pattern (Decision Tree)

```
What are you building?
  |
  +-- Real-time data sync for production app
  |     |
  |     +-- Need at-most-once delivery → Use Events API (polling)
  |     +-- Need at-least-once delivery → Use Webhooks (push)
  |
  +-- Observability/analytics dashboards → Use Datadog streaming
  |
  +-- Backfill or data reconciliation → Use Events API with cursor pagination
```

**Key difference: Webhooks vs Events API**

- Webhooks: WorkOS pushes events to your endpoint when they occur
- Events API: You poll WorkOS for new events on your schedule
- Both deliver the same event types — choice depends on delivery guarantees needed

Check fetched docs for complete event type catalog and schema details.

## Step 3: Pre-Flight Validation

### Required Setup (ALL integrations)

- WorkOS API key exists in environment: `WORKOS_API_KEY` (starts with `sk_`)
- At least ONE connection exists in Dashboard:
  - SSO connection (for `authentication.*` events), OR
  - Directory Sync connection (for `dsync.*` events)

**Why:** Events are generated FROM connections. No connections = no events to sync.

Verify connection exists:

```bash
# Check Dashboard at https://dashboard.workos.com/
# OR use SDK to list connections (check fetched docs for exact method)
```

### Integration-Specific Requirements

**For Webhooks:**

- HTTPS endpoint reachable from internet (no localhost in production)
- Endpoint can respond within 5 seconds (WorkOS timeout)
- Secret storage available (env var, secrets manager)

**For Events API:**

- Cursor storage (database, Redis, file)
- Polling mechanism (cron, worker queue, scheduler)

**For Datadog:**

- Datadog account with API key
- Log management enabled in Datadog plan

## Step 4: Implementation by Pattern

### Pattern A: Webhooks (Push Model)

#### A1. Create Endpoint Handler

Your endpoint MUST:

1. Return `200 OK` immediately (within 5 seconds)
2. Verify signature BEFORE processing payload
3. Handle retries idempotently (WorkOS retries up to 6 times over 3 days)

**Critical trap:** Do NOT perform long operations before returning 200. Queue the event for async processing instead.

```
Endpoint flow:
  1. Extract signature from WorkOS-Signature header
  2. Verify signature using SDK method or manual validation
  3. Return 200 OK immediately
  4. Queue event for async processing (optional)
```

Example (language-agnostic SDK pattern):

```
webhook_secret = env.WORKOS_WEBHOOK_SECRET
payload = request.raw_body
signature_header = request.headers['WorkOS-Signature']

// Verify signature (raises error if invalid)
event = workos.webhooks.verify(
  payload=payload,
  signature_header=signature_header,
  secret=webhook_secret,
  tolerance=180  // seconds
)

// Return 200 immediately
respond_with(status=200)

// Process event asynchronously
queue.enqueue(process_event, event)
```

Check fetched docs for exact SDK method signature in your language.

#### A2. Register Endpoint in Dashboard

Navigate to Dashboard → Webhooks → Add endpoint

You'll receive:

- Webhook signing secret (store as `WORKOS_WEBHOOK_SECRET`)
- Endpoint ID

**IP allowlist (recommended):** Restrict endpoint access to WorkOS IPs. Check fetched docs for current IP list.

#### A3. Signature Validation

**Use SDK validation** (preferred):

- SDK handles timestamp validation (default tolerance: 3-5 minutes)
- SDK handles HMAC-SHA256 signature verification
- Raises exception on invalid signature

**Manual validation** (if SDK unavailable):

1. Parse `WorkOS-Signature` header: `t={timestamp},v1={signature_hash}`
2. Validate timestamp is within tolerance (suggest 180 seconds)
3. Compute expected signature:
   - Concatenate: `{timestamp}.{raw_payload}`
   - HMAC-SHA256 with webhook secret
   - Compare to signature_hash (constant-time comparison)

Check fetched docs for detailed manual validation steps if needed.

### Pattern B: Events API (Poll Model)

#### B1. Implement Polling Loop

```
cursor = load_cursor_from_storage()  // null on first run

while true:
  response = workos.events.list(
    after=cursor,
    limit=100  // adjust based on event volume
  )

  for event in response.data:
    process_event(event)

  if response.has_more:
    cursor = response.list_metadata.after
    save_cursor_to_storage(cursor)
  else:
    break

  sleep(poll_interval)  // e.g., 60 seconds
```

**Critical:** Persist cursor after EACH successful batch. If process crashes, resume from last cursor.

Check fetched docs for exact pagination response structure.

#### B2. Cursor Storage

Options (choose one):

- Database table: `events_cursor (id, cursor_value, updated_at)`
- Redis: `SET events:cursor {value}`
- File: `cursor.txt` (local dev only)

**Trap:** Do NOT store cursor in memory only — you'll reprocess events on restart.

#### B3. Event Deduplication

Events API guarantees at-least-once delivery. Your processor MUST be idempotent:

```
if event_already_processed(event.id):
  skip
else:
  process_event(event)
  mark_as_processed(event.id)
```

Store processed event IDs in database with TTL (suggest 7 days).

### Pattern C: Datadog Streaming

#### C1. Enable in Dashboard

Navigate to Dashboard → Observability → Datadog → Configure

Provide:

- Datadog API key
- Datadog site (e.g., `datadoghq.com`, `datadoghq.eu`)

**Automatic:** Events stream immediately once configured. No code changes needed.

#### C2. Query Events in Datadog

Events appear in Logs → Explorer with source:`workos`

Common queries:

```
// Failed sign-in attempts
source:workos @event:authentication.* @success:false

// New SSO connections
source:workos @event:connection.activated

// Directory sync activity
source:workos @event:dsync.*
```

Check fetched docs for complete event type catalog and available attributes.

#### C3. Create Alerts

Example alert: Spike in failed authentications

```
source:workos @event:authentication.* @success:false
threshold: > 50 in 5 minutes
```

## Step 5: Event Processing Patterns

### Event Type Routing

```
Event naming convention: {domain}.{resource}.{action}

Examples:
  authentication.email_verification_succeeded
  dsync.user.created
  connection.activated
```

Route by domain:

```
switch event.event:
  case starts_with("authentication."):
    handle_auth_event(event)
  case starts_with("dsync."):
    handle_directory_event(event)
  case starts_with("connection."):
    handle_connection_event(event)
```

Check fetched docs for full event type catalog and payload schemas.

### Data Reconciliation

If events are missed (network outage, processing bugs):

1. Use Events API to backfill:

```
start_time = last_known_good_timestamp
events = workos.events.list(
  range_start=start_time,
  range_end=current_time
)
```

2. Compare event IDs against processed set
3. Reprocess missing events

Check fetched docs for exact Events API filtering parameters.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Webhook secret exists (if using webhooks)
[ -n "$WORKOS_WEBHOOK_SECRET" ] && echo "PASS" || echo "FAIL: Set WORKOS_WEBHOOK_SECRET"

# 2. API key valid (if using Events API)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/events?limit=1 \
  -s -o /dev/null -w "%{http_code}" | grep -q 200 && echo "PASS" || echo "FAIL: Check API key"

# 3. Endpoint responds with 200 (if using webhooks)
curl -X POST https://your-endpoint.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -s -o /dev/null -w "%{http_code}" | grep -q 200 && echo "PASS" || echo "FAIL: Endpoint not returning 200"

# 4. At least one connection exists
# Check Dashboard at https://dashboard.workos.com/sso OR /directory-sync
```

**Integration test (webhooks):**
Use Dashboard → Webhooks → Send test event. Verify your endpoint receives and logs the event.

**Integration test (Events API):**

```bash
# Poll for recent events (should return array)
# Check fetched docs for exact SDK method
```

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Timestamp or signature mismatch

Fixes:

1. Check: Using raw request body (not parsed JSON) for signature verification
2. Check: Server clock in sync (NTP enabled) — timestamp must be within tolerance
3. Check: Correct webhook secret from Dashboard (not API key)
4. Check: Using constant-time comparison for signature hash

**Trap:** Some frameworks auto-parse request bodies. You need the RAW bytes before parsing.

### "Events API returns 401"

**Root cause:** Invalid or missing API key

Fixes:

1. Check: `WORKOS_API_KEY` starts with `sk_`
2. Check: Using `Authorization: Bearer {key}` header (not query param)
3. Check: API key has not been rotated in Dashboard

### "No events returned from Events API"

**Root cause:** No connections or no activity

Fixes:

1. Check: At least one SSO or Directory Sync connection exists in Dashboard
2. Check: Connection has been used (users have signed in, directory has synced)
3. Check: `range_start` parameter not set to future date
4. For testing: Trigger test sign-in via SSO connection

### "Webhook endpoint timing out"

**Root cause:** Processing takes > 5 seconds

Fix: Return 200 BEFORE processing. Use async queue:

```
1. Verify signature
2. Store event in queue (Redis, SQS, database)
3. Return 200 OK
4. Background worker processes queue
```

WorkOS will retry if timeout occurs, so handler must be idempotent.

### "Duplicate events received"

**Root cause (Webhooks):** Retry behavior after timeout or 5xx error

Fix: Implement idempotency check:

```
if event_id exists in processed_events table:
  return 200  // already processed
```

**Root cause (Events API):** Polling without proper cursor management

Fix: Persist cursor after each successful batch (see Step 4, Pattern B).

### "Events out of order"

**Expected behavior:** Events may not arrive in strict chronological order (network latency, retries).

Fix: Use `event.created_at` timestamp for ordering, not arrival time. Process events in timestamp order if order matters.

## Related Skills

- workos-authkit-nextjs (generates `authentication.*` events)
- workos-authkit-react (generates `authentication.*` events)
