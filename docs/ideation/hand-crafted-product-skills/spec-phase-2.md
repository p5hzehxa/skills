# Spec: Directory Sync Hand-Crafted Skill

**Template**: ./spec-template-product-skill.md
**Contract**: ./contract.md
**Estimated Effort**: S

## Inputs

- Product: Directory Sync
- File: `plugins/workos/skills/workos/references/workos-directory-sync.guide.md`
- Doc URLs: https://workos.com/docs/directory-sync/quick-start, https://workos.com/docs/directory-sync/understanding-events, https://workos.com/docs/directory-sync/handle-inactive-users, https://workos.com/docs/directory-sync/attributes
- Eval cases: `scripts/eval/cases/directory-sync.yaml` (2 cases: webhook handler, Events API polling)

## Product-Specific Content

### Primary Decision Tree (Step 3): "How to consume directory sync events"

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
        → Same handler logic, different ingestion path
```

**Trap:** Claude often claims webhooks are mandatory. They're not — Events API is a fully supported alternative.

### Primary Code Example (Step 4): Webhook Handler

```
// Webhook endpoint
app.post('/webhooks/workos', async (req, res) => {
  // 1. Verify signature FIRST (check docs for exact method)
  verified = workos.webhooks.verifyEvent({
    payload: req.body,          // raw body, NOT parsed JSON
    sigHeader: req.headers['workos-signature'],
    secret: WORKOS_WEBHOOK_SECRET
  })

  // 2. Return 200 IMMEDIATELY (WorkOS times out at 10s)
  res.status(200).send('OK')

  // 3. Process event asynchronously
  event = verified.event
  data = verified.data

  switch (event) {
    case 'dsync.user.created':
      upsert_user(data)          // Use upsert, not insert (idempotency)
    case 'dsync.user.updated':
      if (data.state === 'inactive') deprovision_user(data)
      else update_user(data)
    case 'dsync.user.deleted':
      delete_user(data)          // Rare — most providers use state:inactive
    case 'dsync.deleted':
      delete_all_directory_users(data.id)  // CRITICAL: see trap below
  }
})
```

### Secondary Pattern (Step 5): The `dsync.deleted` Trap

**This is the most common DSync integration error.** When a directory is deleted:

- WorkOS sends ONE `dsync.deleted` event
- WorkOS does NOT send individual `dsync.user.deleted` events for each user
- Your handler MUST cascade: delete ALL users and groups with that `directory_id`

```
dsync.deleted fires:
  |
  +-- What you expect: dsync.user.deleted × N (one per user)
  |     → WRONG. These events never arrive.
  |
  +-- What actually happens: just dsync.deleted (one event)
        → Your handler must: DELETE FROM users WHERE directory_id = $1
        → Also: DELETE FROM groups WHERE directory_id = $1
        → Do this in a transaction
```

### Additional Trap: User Identity Key

**Use `email` as the stable user identity, NOT the WorkOS `id`.** The WorkOS directory user ID changes if the user is deleted and recreated in the directory provider. Email is stable across recreations.

### Error Recovery

1. **`"Invalid signature"` on all webhooks** — Webhook secret mismatch. Fix: verify `WORKOS_WEBHOOK_SECRET` matches Dashboard value (starts with `wh_secret_`). Confirm payload is passed as raw string, not parsed JSON.

2. **Events API returns empty array** — Wrong event type filter or stale cursor. Fix: use `dsync.*` (with wildcard), not `dsync` alone. Verify `after` param is within 30-day retention.

3. **Users still active after directory deletion** — Missing cascade logic for `dsync.deleted`. Fix: add `DELETE FROM users WHERE directory_id = $1` to `dsync.deleted` handler. Do NOT wait for individual user delete events.

### Verification Commands

```bash
# 1. Webhook endpoint exists and rejects unsigned requests
curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" -d '{}' | grep -q "401" && echo "✓ rejects unsigned" || echo "✗ FAIL"

# 2. Signature verification exists in code
grep -r "verifyEvent\|verifySignature\|constructEvent" src/ || echo "FAIL: No signature verification"

# 3. dsync.deleted handler cascades
grep -r "dsync.deleted" src/ | grep -v "dsync.user.deleted\|dsync.group.deleted" || echo "FAIL: No dsync.deleted handler"

# 4. Uses upsert pattern (not plain INSERT)
grep -ri "upsert\|on conflict\|ON DUPLICATE" src/ || echo "WARN: No upsert pattern found"
```

## Deviations from Template

- Step 5 has TWO traps (dsync.deleted cascade + user identity key) because these are the two most common DSync mistakes
- Code example is a full webhook handler (longer than typical) because the return-200-immediately pattern is critical
- Verification includes a curl probe that checks for 401 on unsigned requests

## Validation

```bash
wc -c plugins/workos/skills/workos/references/workos-directory-sync.guide.md  # Target: 3000-5000 bytes
bun run eval -- --product=directory-sync --no-cache  # Target: delta > 0% (was 0-14% across runs)
```
