<!-- hand-crafted -->

# WorkOS Directory Sync — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing WORKOS_API_KEY"
echo $WORKOS_WEBHOOK_SECRET | grep '^wh_secret_' && echo "✓ valid" || echo "✗ missing WORKOS_WEBHOOK_SECRET"
```

`WORKOS_WEBHOOK_SECRET` only needed for webhooks. Skip if using Events API only.

## Step 3: Event Consumption (Decision Tree)

```
How will you receive directory sync events?
  |
  +-- Need real-time user provisioning/deprovisioning
  |     → Use Webhooks (push-based)
  |     → Endpoint: POST /webhooks/workos
  |     → MUST: verify signature, return 200 within 10s, process async
  |
  +-- Batch reconciliation or recovering missed events
  |     → Use Events API (pull-based)
  |     → Method: workos.events.listEvents({ events: ['dsync.*'], after: cursor })
  |     → Poll on cron (e.g., every 60s)
  |
  +-- Both (recommended for production)
        → Webhooks for real-time + Events API for backfill
```

**Trap:** Webhooks are NOT mandatory. The Events API is a fully supported alternative for batch processing and recovering missed events.

## Step 4: Webhook Handler

```
app.post('/webhooks/workos', async (req, res) => {
  // 1. Verify signature FIRST (raw body, NOT parsed JSON)
  verified = workos.webhooks.verifyEvent({
    payload: req.body,
    sigHeader: req.headers['workos-signature'],
    secret: WORKOS_WEBHOOK_SECRET
  })

  // 2. Return 200 IMMEDIATELY (WorkOS times out at 10s)
  res.status(200).send('OK')

  // 3. Process event asynchronously
  switch (verified.event) {
    case 'dsync.user.created':
      upsert_user(verified.data)       // Upsert, not insert (idempotency)
    case 'dsync.user.updated':
      if (verified.data.state === 'inactive') deprovision_user(verified.data)
      else update_user(verified.data)
    case 'dsync.user.deleted':
      delete_user(verified.data)       // Rare — most providers use state:inactive
    case 'dsync.deleted':
      cascade_delete_directory(verified.data.id)  // CRITICAL: see Step 5
  }
})
```

### Ruby (Rails) Signature Verification

```
# config/initializers/workos.rb
require "workos"
WorkOS.key = ENV["WORKOS_API_KEY"]

# app/controllers/workos_webhooks_controller.rb
class WorkosWebhooksController < ActionController::API
  # Ensure raw body is available (disable JSON parsing for this endpoint)
  def receive
    payload   = request.raw_post
    sig       = request.headers["Workos-Signature"]
    secret    = ENV["WORKOS_WEBHOOK_SECRET"]

    event = WorkOS::Webhooks.verify_event(payload: payload, sig_header: sig, secret: secret)

    # Acknowledge immediately (WorkOS timeout ~10s)
    head :ok

    case event["event"]
    when "dsync.user.created"
      # upsert user
    when "dsync.user.updated"
      if event.dig("data", "state") == "inactive"
        # deprovision user
      end
    when "dsync.deleted"
      # cascade delete by directory_id
    end
  rescue WorkOS::SignatureVerificationError
    head :unauthorized
  end
end
```

## Step 5: Critical Traps

### Trap 1: `dsync.deleted` Cascade

When a directory is deleted, WorkOS sends ONE `dsync.deleted` event. It does NOT send individual `dsync.user.deleted` or `dsync.group.deleted` events.

```
dsync.deleted fires:
  |
  +-- What you expect: dsync.user.deleted × N (one per user)
  |     → WRONG. These events never arrive.
  |
  +-- What actually happens: just dsync.deleted (one event)
        → DELETE FROM users WHERE directory_id = $1
        → DELETE FROM groups WHERE directory_id = $1
        → Run both in a transaction
```

### Trap 2: User Identity Key

Use `email` as stable user identity, NOT the WorkOS `id`. The directory user ID (`directory_user_*`) changes if the user is recreated in the provider. Email is stable. Use for upserts: `WHERE email = $1`.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Webhook endpoint rejects unsigned requests
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" -d '{}' | grep -q "401" && echo "✓ rejects unsigned" || echo "✗ FAIL"

# 2. Signature verification exists in code
grep -r "verifyEvent\|verifySignature\|constructEvent" src/ || echo "FAIL: No signature verification"

# 3. dsync.deleted handler cascades (not just user-level deletes)
grep -r "dsync.deleted" src/ | grep -v "dsync.user.deleted\|dsync.group.deleted" || echo "FAIL: No dsync.deleted handler"

# 4. Uses upsert pattern for idempotency
grep -ri "upsert\|on conflict\|ON DUPLICATE" src/ || echo "WARN: No upsert pattern found"
```

## Error Recovery

### "Invalid signature"

**Cause:** Secret mismatch or payload parsing
**Fix:**

1. Verify `WORKOS_WEBHOOK_SECRET` matches Dashboard value (`wh_secret_*`)
2. Pass payload as raw string, not parsed JSON
3. Check header name: `workos-signature`

### Events API returns empty array

**Cause:** Wrong event filter or stale cursor
**Fix:**

1. Use `dsync.*` wildcard, not `dsync` alone
2. Verify `after` param is within 30-day retention window
3. Test with `workos.events.listEvents({ limit: 1 })` to confirm connectivity

### Users still active after directory deletion

**Cause:** Missing cascade logic for `dsync.deleted`
**Fix:**

1. Add `DELETE FROM users WHERE directory_id = $1` to `dsync.deleted` handler
2. Add `DELETE FROM groups WHERE directory_id = $1` in same transaction
3. Do NOT wait for individual user delete events — they never fire
