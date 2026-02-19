<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api
- https://workos.com/docs/events/data-syncing/data-reconciliation

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Event Source Requirement

WorkOS Events require an active event source to generate events. You need at least ONE of:
- SSO connection configured
- Directory Sync connection configured

**Check:** Visit WorkOS Dashboard → verify at least one connection exists before proceeding.

## Step 3: Integration Pattern (Decision Tree)

```
What's your use case?
  |
  +-- Observability/Analytics only
  |     --> Use Datadog streaming (Step 4)
  |     --> No webhook endpoint needed
  |
  +-- Data syncing to your database
  |     --> Use webhooks (Step 5) OR Events API (Step 6)
  |     --> Decision: Webhooks = push, Events API = poll
  |
  +-- Both observability + data syncing
        --> Datadog for metrics + Webhooks/API for data
```

**Key difference:**
- **Webhooks** = WorkOS pushes events to your endpoint
- **Events API** = You poll WorkOS for new events
- **Datadog** = Observability only, no data access for your app

## Step 4: Datadog Integration (Observability Pattern)

### Setup

1. Navigate: WorkOS Dashboard → Events → Datadog
2. Follow dashboard wizard to connect Datadog account
3. Configure which event types to stream

**Verification:**

```bash
# Check Datadog Logs Explorer shows WorkOS events
# Search for source:workos
```

Check fetched docs for dashboard setup flow and available event types.

**Use cases covered:**
- Authentication trends and metrics
- Customer issue debugging
- User activity reports per organization
- Alerting on anomalies (e.g., failed login spikes)

**Does NOT provide:** Direct data access for your application logic. For that, use webhooks or Events API.

## Step 5: Webhook Integration (Push Pattern)

### A. Create Webhook Endpoint

**Framework-agnostic pattern:**

```
Endpoint requirements:
1. Accept POST requests with JSON body
2. Verify signature BEFORE processing (see Step 5B)
3. Return 200 immediately (do NOT wait for processing)
4. Process event asynchronously (job queue, background worker)
```

**Critical pattern — Return 200 immediately:**

```
Request arrives
  |
  +-- Verify signature
  |
  +-- Return 200 OK (synchronous)
  |
  +-- Queue event for processing (asynchronous)
```

If you process synchronously and take >30s, WorkOS will retry (up to 6 times over 3 days with exponential backoff).

### B. Signature Verification

**Get webhook secret:**
1. WorkOS Dashboard → Events → Webhooks → Create endpoint
2. Copy generated secret to `WORKOS_WEBHOOK_SECRET` env var

**SDK verification (recommended):**

Check fetched docs for SDK method signature (varies by language). Pattern:

```
SDK.verifyWebhookSignature(
  payload: raw request body (string),
  signature: WorkOS-Signature header value,
  secret: WORKOS_WEBHOOK_SECRET
)
```

**Manual verification (if no SDK):**

Parse `WorkOS-Signature` header:
```
t=1234567890123,v1=abc123...
  |              |
  timestamp      HMAC SHA256 hash
```

Steps:
1. Extract `t=` and `v1=` values
2. Validate timestamp is within tolerance (default: 3-5 minutes)
3. Compute expected signature: HMAC_SHA256(secret, "{timestamp}.{raw_body}")
4. Compare computed signature to `v1=` value using constant-time comparison

**Trap warning:** Always use raw request body for signature verification. If you parse JSON first, signature will fail.

### C. IP Allowlist (Optional Security)

Restrict endpoint to WorkOS IPs:

```
3.217.146.166
44.209.16.164
54.91.104.146
```

**Framework examples:**

```bash
# Nginx
allow 3.217.146.166;
allow 44.209.16.164;
allow 54.91.104.146;
deny all;

# AWS Security Group
# Add inbound rules for these IPs on webhook port
```

### D. Register Endpoint

1. WorkOS Dashboard → Events → Webhooks → Create endpoint
2. Enter endpoint URL (must be HTTPS in production)
3. Select event types to receive
4. Save and copy webhook secret

**Verification:**

```bash
# WorkOS will send test event
# Check your endpoint logs for POST request with event type test.connection
```

## Step 6: Events API Integration (Poll Pattern)

**Use when:**
- You can't expose a public webhook endpoint
- You want full control over polling frequency
- You're implementing data reconciliation (see Step 7)

**Pattern:**

```
1. Poll Events API with after= cursor (starts with empty cursor)
2. Process returned events
3. Store cursor for next poll
4. Repeat from step 1
```

Check fetched docs for SDK method signature and pagination details.

**Cursor persistence:** Store cursor in database, not in-memory. If service restarts mid-poll, you'll miss events.

## Step 7: Data Reconciliation

**Problem:** Events may be delivered out of order or missed during downtime.

**Solution pattern:**

```
Daily reconciliation job:
  |
  +-- Fetch all active entities (users, organizations, etc.)
  |   via WorkOS management APIs
  |
  +-- Compare with local database
  |
  +-- Update differences
```

Check fetched docs for reconciliation strategies per entity type.

**When to run:**
- Daily for critical data (users, org memberships)
- Weekly for less critical data (metadata, settings)
- After any extended downtime

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables set
env | grep -E 'WORKOS_(API_KEY|CLIENT_ID|WEBHOOK_SECRET)'

# 2. At least one connection exists (generates events)
# Manual: Check WorkOS Dashboard for SSO or Directory Sync connection

# 3. Webhook endpoint returns 200 (if using webhooks)
curl -X POST https://your-endpoint/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test":"payload"}'
# Should return 200 OK

# 4. Test event received (if using webhooks)
# WorkOS Dashboard → Webhooks → Send test event
# Check endpoint logs for test.connection event

# 5. Signature verification works
# Send test event → verify endpoint processes it (not rejected as invalid)
```

## Error Recovery

### "Webhook signature verification failed"

**Root causes:**
1. Using parsed JSON body instead of raw request body
2. Incorrect webhook secret (check env var matches dashboard)
3. Timestamp tolerance too strict (increase to 5 minutes)

**Fix:**
- Log the raw request body and signature header
- Verify raw body is used for signature computation
- Check webhook secret matches dashboard value exactly

### "Event delivery failed" in WorkOS Dashboard

**Root causes:**
1. Endpoint not returning 200 OK within 30s
2. Endpoint not accessible (firewall, DNS issues)
3. SSL certificate invalid

**Fix:**
- Return 200 immediately, process async
- Verify endpoint is publicly accessible: `curl -I https://your-endpoint/webhooks/workos`
- Check SSL certificate: `curl -v https://your-endpoint/webhooks/workos` (should show valid cert)

### "Missing events" or "Duplicate events"

**Root causes:**
1. Not implementing idempotency (processing same event twice)
2. Not storing cursor between polls (Events API)
3. Downtime during webhook delivery

**Fix for webhooks:**
- Store event IDs in database
- Check if event ID exists before processing
- Use database transaction to store ID + process event atomically

**Fix for Events API:**
- Persist cursor after each successful poll
- Use database transaction: fetch events → process → update cursor

### "Events arriving out of order"

**Expected behavior:** Events are not guaranteed to arrive in chronological order.

**Fix:**
- Use event timestamps for ordering, not arrival time
- Implement data reconciliation (Step 7)
- For critical state, use WorkOS management APIs as source of truth

### "No events generating"

**Root causes:**
1. No SSO or Directory Sync connection configured
2. No user activity (events only fire on activity)

**Fix:**
- Verify connection exists in WorkOS Dashboard
- Trigger test activity (sign in, directory sync, etc.)
- Check event types selected in webhook configuration

## Event Object Structure

All events share:
- `event` - String identifier (format: `{domain}.{resource}.{action}`)
- `id` - Unique event identifier (starts with `event_`)
- `created_at` - ISO 8601 timestamp
- `data` - Event-specific payload

Check fetched docs for complete event type catalog and schemas.

## Related Skills

- workos-authkit-nextjs - For SSO connection setup (event source)
