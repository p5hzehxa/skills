<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs before continuing:

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### API Keys

Check environment variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### WorkOS Dashboard Setup

Confirm in dashboard.workos.com:

- Organization exists for the customer
- Directory connection configured (provider selected)
- Webhooks endpoint configured OR Events API access enabled

### SDK Installation

Verify SDK package exists in project dependencies before writing integration code.

## Step 3: Event Processing Strategy (Decision Tree)

Choose event ingestion method:

```
Event processing needs?
  |
  +-- Real-time, low latency?
  |   |
  |   +-- Yes --> Use Webhooks (recommended)
  |   |           - POST requests to your endpoint
  |   |           - Verify signatures with workos.webhooks.verifyEvent()
  |   |           - Return 200 immediately, process async
  |   |
  |   +-- No  --> Use Events API
  |               - Poll with workos.events.listEvents()
  |               - Filter by directory_id, after cursor
  |               - Use for batch processing, reconciliation
  |
  +-- Recovering missed events?
      |
      +-- Yes --> Events API
                  - Query historical events
                  - Backfill from specific timestamp
```

**CRITICAL:** Webhooks and Events API are NOT mutually exclusive. You can use both:

- Webhooks for real-time processing
- Events API for batch reconciliation or recovering missed events

Do NOT claim webhooks are mandatory or that polling is not supported.

## Step 4: Event Handler Implementation

Create handler endpoint (webhooks) or polling function (Events API).

### Webhook Pattern

```
POST /webhooks/workos
  |
  1. Verify signature with workos.webhooks.verifyEvent(payload, signature, secret)
  |
  2. Return 200 immediately (< 5 seconds)
  |
  3. Queue event for async processing
  |
  4. Process event in background job
```

### Events API Pattern

```
Polling loop (cron job, background worker):
  |
  1. Call workos.events.listEvents({
       events: ['dsync.user.created', 'dsync.user.updated', ...],
       after: last_cursor
     })
  |
  2. Process events in batch
  |
  3. Store cursor for next poll
```

Check fetched docs for exact method signatures and parameters.

### Event Processing Rules (ALL must pass)

For EVERY event received:

1. **Upsert pattern** - use `ON CONFLICT` or equivalent to handle duplicate events
2. **Idempotency** - processing same event twice should be safe
3. **Ordering** - events may arrive out of order; use timestamps to resolve conflicts
4. **Retry** - failed processing must retry with exponential backoff

## Step 5: Event Type Handling

### Directory Lifecycle

**`dsync.activated`**

- Store `directory_id` in your database
- Associate with `organization_id`
- Directory is now live and will send user/group events

**`dsync.deleted`** (CRITICAL TRAP)

- Remove directory association from organization
- Delete or mark as deleted ALL users in that directory
- Delete or mark as deleted ALL groups in that directory
- **IMPORTANT:** WorkOS sends ONLY `dsync.deleted` — no individual `dsync.user.deleted` or `dsync.group.deleted` events follow
- Process cleanup in single transaction to avoid partial state

### User Lifecycle

**`dsync.user.created`**

- Insert user into your users table
- Link to `directory_id` and `organization_id`
- Trigger onboarding flow (welcome email, provisioning, etc.)
- During initial directory sync, you'll receive this for EVERY existing user

**`dsync.user.updated`**

- Update user attributes from event payload
- Check `previous_attributes` to see what changed
- Handle `state` changes (especially `active` → `inactive`)
- Custom attributes are shallow-diffed; `null` in `previous_attributes` means new attribute

**`dsync.user.deleted`**

- Hard delete user from directory
- **RARE EVENT** - most providers soft-delete via `dsync.user.updated` with `state: inactive`
- Check fetched docs for provider-specific deletion behavior

### Soft vs Hard Deletion (CRITICAL)

```
User removed from directory?
  |
  +-- Most providers (Azure AD, Okta, etc.)
  |   |
  |   +-- Emit: dsync.user.updated with state: inactive
  |   +-- Action: Deprovision access, retain user record
  |
  +-- Some providers (rare)
      |
      +-- Emit: dsync.user.deleted
      +-- Action: Hard delete user record
```

**IMPORTANT:** As of Oct 19, 2023, new WorkOS environments delete users moved to `inactive` state. Check fetched docs for your environment's behavior and retention options.

### Group Lifecycle

**`dsync.group.created`**

- Insert group into your groups table
- Link to `directory_id` and `organization_id`
- Event order: `dsync.user.created` → `dsync.group.created` → `dsync.group.user_added`

**`dsync.group.updated`**

- Update group attributes (name, description, etc.)
- Check `previous_attributes` for changes

**`dsync.group.deleted`**

- Remove group from your database
- Handle user-group association cleanup

**`dsync.group.user_added`**

- Add user to group in your system
- Update user permissions/roles based on group membership

**`dsync.group.user_removed`**

- Remove user from group
- Revoke permissions granted by group membership

## Step 6: Implementation Checklist

### Database Schema

- [ ] `directories` table with `workos_directory_id`, `organization_id`
- [ ] `users` table with `workos_user_id`, `directory_id`, `organization_id`, `state`
- [ ] `groups` table with `workos_group_id`, `directory_id`, `organization_id`
- [ ] `group_memberships` junction table
- [ ] Event processing cursor/offset storage (if using Events API)

### Event Handler

- [ ] Signature verification (webhooks) or authentication (Events API)
- [ ] Immediate 200 response (webhooks)
- [ ] Async processing queue
- [ ] Idempotent upsert logic
- [ ] Transaction safety for multi-record operations

### Error Handling

- [ ] Retry logic with exponential backoff
- [ ] Dead letter queue for permanently failed events
- [ ] Alerting for processing failures
- [ ] Fallback to Events API if webhook delivery fails

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
env | grep -E 'WORKOS_(API_KEY|CLIENT_ID)' || echo "FAIL: Missing env vars"

# 2. Check webhook endpoint returns 200 (if using webhooks)
curl -X POST http://localhost:3000/webhooks/workos -H "Content-Type: application/json" -d '{}' | grep -q "200" || echo "FAIL: Webhook endpoint not responding"

# 3. Check database tables exist
# (Replace with your database inspection command)
psql -c "\dt directories" | grep -q "directories" || echo "FAIL: Missing directories table"

# 4. Verify signature verification exists in code
grep -r "verifyEvent\|constructEvent" . || echo "FAIL: No signature verification found"
```

## Error Recovery

### "Invalid signature" for webhook events

**Root cause:** Webhook secret mismatch or signature verification missing.

Fix:

1. Verify `WORKOS_WEBHOOK_SECRET` matches value in WorkOS Dashboard
2. Ensure signature from `WorkOS-Signature` header is passed to verification function
3. Check payload is passed as raw string (not parsed JSON) to verification

### Events arrive out of order

**Root cause:** Network latency, retries, or concurrent delivery.

Fix:

1. Add `occurred_at` timestamp comparison in upsert logic
2. Reject older events: `WHERE occurred_at > existing_record.occurred_at`
3. Do NOT rely on event receive order for correctness

### `dsync.deleted` leaves orphaned users

**Root cause:** Missing bulk delete logic for directory deletion.

Fix:

1. Add `ON DELETE CASCADE` to foreign keys, OR
2. Query all users with matching `directory_id` and delete in transaction
3. Do NOT wait for individual `dsync.user.deleted` events (they won't come)

### Duplicate user creation

**Root cause:** Processing same `dsync.user.created` event twice.

Fix:

1. Use `ON CONFLICT (workos_user_id) DO UPDATE` in SQL, or equivalent
2. Store event ID and skip if already processed
3. Never use plain INSERT for event processing

### Missed events during downtime

**Root cause:** Webhook endpoint was unreachable.

Fix:

1. Use Events API to backfill: `workos.events.listEvents({ after: last_known_cursor })`
2. Filter events by timestamp range covering downtime
3. Process backfill events with same idempotent logic as webhooks

### "User not found" when processing group events

**Root cause:** `dsync.group.user_added` processed before `dsync.user.created`.

Fix:

1. Check if user exists before adding to group
2. If missing, fetch user via workos.directorySync.getUser() and create
3. Retry group event after short delay if user creation is in-flight

### Inactive users not deprovisioned

**Root cause:** Not handling `state: inactive` in `dsync.user.updated`.

Fix:

1. Add explicit check: `if (event.data.state === 'inactive') { deprovisionUser() }`
2. Revoke sessions, disable login, remove from groups
3. Decide if you want to retain user data or delete (check environment settings)

## Related Skills

For authentication integration with Directory Sync users:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
