<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for source of truth:
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Event Processing Strategy (Decision Tree)

```
How will you consume directory sync events?
  |
  +-- Real-time updates needed
  |   |
  |   +-- Push-based → Use Webhooks (recommended)
  |   |
  |   +-- Pull-based → Use Events API (listEvents with polling)
  |
  +-- Batch processing / reconciliation
      |
      +-- Use Events API (query by after parameter for ranges)
```

**CRITICAL:** WorkOS supports BOTH webhooks AND the Events API. Webhooks are recommended (push-based, real-time), but NOT mandatory. The Events API is valid for batch processing, recovering missed events, or reconciliation.

Check fetched docs for webhook signature verification and Events API pagination patterns.

## Step 3: Event Handler Implementation

Create endpoint to process directory sync events. For webhooks: verify signature before processing. For Events API: poll with exponential backoff.

**Primary integration pattern (webhooks):**

```javascript
// Webhook endpoint
app.post('/webhooks/workos', async (req, res) => {
  // 1. Verify signature (check docs for exact method)
  const isValid = workos.webhooks.verifySignature(req.body, req.headers);
  if (!isValid) return res.status(401).send('Invalid signature');
  
  // 2. Return 200 immediately (WorkOS timeout = 10s)
  res.status(200).send('Received');
  
  // 3. Process event asynchronously
  await processEvent(req.body.event, req.body.data);
});
```

**Alternative pattern (Events API polling):**

```javascript
// Background job
setInterval(async () => {
  const events = await workos.events.listEvents({
    events: ['dsync.*'],
    after: lastProcessedEventId
  });
  
  for (const event of events.data) {
    await processEvent(event.event, event.data);
    lastProcessedEventId = event.id;
  }
}, 60000); // Poll interval
```

## Step 4: Core Event Handlers (Decision Map)

Map each event type to database operation:

```
Event Type                 → Database Operation
dsync.activated            → Associate directory_id with organization
dsync.deleted              → Remove org's directory association + mark all users/groups deleted
dsync.user.created         → INSERT user with directory_id, email, state
dsync.user.updated         → UPSERT user (email may change)
dsync.user.deleted         → Mark user deleted (preserve audit trail)
dsync.group.created        → INSERT group with directory_id, name
dsync.group.updated        → UPDATE group name/members
dsync.group.deleted        → Mark group deleted
dsync.group.user_added     → INSERT group membership
dsync.group.user_removed   → DELETE group membership
```

**TRAP WARNING — dsync.deleted behavior:**

When `dsync.deleted` fires, WorkOS does NOT send individual `dsync.user.deleted` or `dsync.group.deleted` events. Your handler MUST process the directory-level deletion by:
1. Marking ALL users in that directory as deleted
2. Marking ALL groups in that directory as deleted
3. Removing the directory association from the organization

This is the most common integration error — agents expect granular delete events that never arrive.

## Step 5: State Management (Critical Fields)

Store these attributes from event payloads:

**User records:**
- `id` (WorkOS user ID, prefix `directory_user_`)
- `directory_id` (prefix `directory_`)
- `organization_id` (your internal org ID)
- `email` (primary key for matching)
- `first_name`, `last_name`
- `state` (active/inactive/suspended — check docs for enum values)
- `custom_attributes` (JSON object, varies by provider)

**Group records:**
- `id` (WorkOS group ID, prefix `directory_group_`)
- `directory_id`
- `name`

**Membership records:**
- `user_id` + `group_id` composite key

**CRITICAL:** Use `email` for user identity, not `id`. The WorkOS user ID changes if the user is deleted and recreated in the directory provider. Email is stable.

## Step 6: Inactive User Handling (Decision Tree)

```
How to handle user with state=inactive?
  |
  +-- Block access immediately → Revoke sessions on dsync.user.updated (state change)
  |
  +-- Grace period → Schedule deactivation job (e.g., 7 days)
  |
  +-- Preserve access → Ignore state field (not recommended)
```

Check fetched docs for state enum values and provider-specific behavior (some providers use suspended, others use inactive).

## Step 7: Role Assignment (Optional)

If using WorkOS role assignment feature:

1. Check `dsync.user.created` and `dsync.user.updated` payloads for `role` object
2. Map `role.slug` to your app's permission groups
3. Update user permissions on role change events

Check fetched docs for enabling role assignment in dashboard and supported providers.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Webhook signature verification works
curl -X POST localhost:3000/webhooks/workos -H "Content-Type: application/json" \
  -d '{"event":"dsync.user.created","data":{}}' | grep -q "401" && echo "✓ rejects unsigned" || echo "✗ FAIL"

# 2. Database has directory sync tables
psql -c "\dt" | grep -E "(users|groups|memberships)" || echo "✗ FAIL: missing tables"

# 3. Event handler processes dsync.deleted correctly
grep -r "dsync.deleted" . | grep -q "mark.*deleted" && echo "✓ handles directory deletion" || echo "✗ FAIL: missing dsync.deleted logic"

# 4. User records store state field
psql -c "\d users" | grep -q "state" && echo "✓ tracks user state" || echo "✗ FAIL: missing state column"

# 5. Using email as identity key
grep -r "WHERE email" . || echo "WARN: not using email for user lookups (risky)"
```

## Error Recovery

### Webhook signature validation fails

**Symptom:** All webhooks rejected with 401

**Cause:** Incorrect secret or missing signature header

**Fix:**
1. Verify `WORKOS_WEBHOOK_SECRET` matches dashboard value (starts with `wh_secret_`)
2. Check webhook signature header name (usually `WorkOS-Signature`)
3. Confirm timestamp tolerance window (default 3 minutes)

### Events API returns empty array

**Symptom:** `listEvents()` returns no data despite active directory

**Cause:** Incorrect event type filter or after parameter beyond retention window

**Fix:**
1. Check event type pattern: use `dsync.*` not `dsync` (missing wildcard)
2. Verify `after` parameter is within 30-day retention (check docs for exact retention policy)
3. Use `listEvents({ limit: 1 })` without filters to confirm API connectivity

### dsync.deleted processed but users still active

**Symptom:** Users can still access app after directory deletion

**Cause:** Handler not cascading deletion to all directory users

**Fix:**
1. Add explicit logic: `DELETE FROM users WHERE directory_id = $1` or mark deleted
2. Verify session revocation runs on user deletion
3. Do NOT wait for individual `dsync.user.deleted` events (they don't fire)

### User email changed, now duplicate records

**Symptom:** Two user records for same person after email change

**Cause:** Using WorkOS user `id` as primary key instead of `email`

**Fix:**
1. Use `email` as lookup key in `dsync.user.updated` handler
2. Treat `id` as ephemeral (changes on recreate)
3. Store both `id` and `email`, index on `email`

### Role assignments not syncing

**Symptom:** `role` object missing from user event payloads

**Cause:** Role assignment feature not enabled in dashboard

**Fix:**
1. Check fetched docs for dashboard configuration steps
2. Verify directory provider supports role assignment (not all do)
3. Confirm customer's IdP has role attribute mapped correctly

## Related Skills

- workos-authkit-nextjs (for authentication + directory sync integration)
