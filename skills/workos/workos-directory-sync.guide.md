<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Setup

- Confirm WorkOS SDK is installed (check `node_modules/@workos-inc` or equivalent for your language)
- Confirm directory connection exists in [WorkOS Dashboard](https://dashboard.workos.com/)

## Step 3: Architecture Decision Tree

```
How will you receive directory events?
  |
  +-- Webhooks (RECOMMENDED)
  |   |
  |   +-- Real-time push
  |   +-- Lower latency
  |   +-- Requires public endpoint
  |   +-- See Step 4A
  |
  +-- Events API Polling
      |
      +-- Batch processing
      +-- Data reconciliation
      +-- Recovery from missed events
      +-- See Step 4B
```

**Both approaches are supported.** Webhooks are recommended for real-time sync. Events API is valid for batch jobs or augmenting webhook reliability.

## Step 4A: Webhook Implementation

### Create Webhook Endpoint

Check fetched docs for SDK method to verify webhook signatures.

**Pattern (pseudocode):**

```
POST /webhooks/workos
  |
  +-- 1. Verify signature using SDK
  +-- 2. Parse event payload
  +-- 3. Route to event handler (see Step 5)
  +-- 4. Return 200 immediately (do NOT wait for processing)
```

**CRITICAL:** Return 200 BEFORE processing the event. Process async (queue, background job, etc.). WorkOS will retry if you don't return 200 within timeout.

### Register Webhook in Dashboard

1. Navigate to Webhooks section in WorkOS Dashboard
2. Add endpoint URL (must be publicly accessible)
3. Select Directory Sync events to receive
4. Save webhook secret for signature verification

**Verification:**

```bash
# Test webhook receives events
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Should return 200
```

## Step 4B: Events API Implementation

Use `workos.events.listEvents()` to poll for directory events.

**Pattern (pseudocode):**

```
Poll job (runs every N minutes):
  |
  +-- 1. Fetch events since last cursor
  +-- 2. For each event, route to handler (see Step 5)
  +-- 3. Save cursor for next poll
  +-- 4. Update last_sync timestamp
```

Check fetched docs for:
- Exact SDK method signature for listing events
- Cursor pagination pattern
- Event filtering by type

**Use case:** Batch reconciliation, recovering from downtime, validating webhook delivery.

## Step 5: Event Handling (CRITICAL)

### Event Routing Pattern

**Trap warning:** `dsync.deleted` does NOT trigger individual `dsync.user.deleted` or `dsync.group.deleted` events.

```
Event type decision tree:
  |
  +-- dsync.activated
  |   → Save directory_id, associate with organization_id
  |
  +-- dsync.deleted
  |   → Remove ALL users/groups for this directory
  |   → NO individual delete events will follow
  |   → Ignore connection.state (indicates state before deletion)
  |
  +-- dsync.user.created
  |   → Insert user into your users table
  |   → Associate with directory_id and organization_id
  |   → Trigger onboarding flow (emails, etc.)
  |
  +-- dsync.user.updated
  |   → Update user attributes (check previous_attributes for changes)
  |   → Handle state=inactive (soft delete - see below)
  |
  +-- dsync.user.deleted
  |   → Hard delete user from your app
  |   → Rare - most providers use soft delete (inactive state)
  |
  +-- dsync.group.created
  |   → Insert group into your groups table
  |   → Event order: user.created → group.created → group.user_added
  |
  +-- dsync.group.updated
  |   → Update group attributes
  |
  +-- dsync.group.deleted
  |   → Remove group from your app
  |
  +-- dsync.group.user_added
  |   → Add user to group membership
  |
  +-- dsync.group.user_removed
      → Remove user from group membership
```

### Inactive Users (CRITICAL)

**Trap warning:** After Oct 19, 2023, WorkOS deletes users moved to inactive state by default.

```
user.updated with state=inactive?
  |
  +-- New environments (post Oct-2023)
  |   → User will be deleted in WorkOS
  |   → Followed by dsync.user.deleted event
  |   → Handle both updated(inactive) AND deleted events
  |
  +-- Legacy environments
      → User remains in WorkOS as inactive
      → Soft delete in your app
      → Check WorkOS Dashboard for your environment behavior
```

To retain inactive users, contact WorkOS support. See: https://workos.com/docs/directory-sync/handle-inactive-users

### Idempotency (REQUIRED)

**Use upsert pattern for all event handlers:**

- `user.created` → upsert by `user.id`
- `user.updated` → upsert by `user.id`
- `group.created` → upsert by `group.id`

This handles webhook retries and Events API overlapping polls without duplication.

### previous_attributes Pattern

`dsync.user.updated` and `dsync.group.updated` include `previous_attributes` showing changes:

- New attributes have `previous_attributes[key] = null`
- Changed attributes show old value
- Shallow diff (root properties and `custom_attributes` only)

Use this to trigger conditional logic (e.g., email change triggers re-verification).

## Step 6: Database Schema

**Recommended structure:**

```
organizations table:
  - id
  - workos_directory_id (nullable, from dsync.activated)

users table:
  - id
  - organization_id
  - workos_user_id (from event payload)
  - email
  - state (active/inactive)
  - custom_attributes (JSON)

groups table:
  - id
  - organization_id
  - workos_group_id
  - name

group_memberships table:
  - user_id
  - group_id
```

**Index requirements:**

- `users(workos_user_id)` - for upsert
- `users(organization_id)` - for directory deletion
- `groups(workos_group_id)` - for upsert

## Step 7: Role Assignment (Optional)

Check fetched docs for identity provider role assignment:
https://workos.com/docs/directory-sync/identity-provider-role-assignment

**Role slugs** are passed in `role` attribute. Map these to your app's permission system during user creation/update.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Webhook endpoint returns 200
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"event": "dsync.activated", "data": {}}' \
  | grep -q "200"

# 2. Webhook secret configured
echo $WORKOS_WEBHOOK_SECRET | grep -q "whsec_"

# 3. Database has required indexes
# (SQL for your database - check users.workos_user_id index exists)

# 4. Events API can fetch
# Run SDK method to list events - should not error

# 5. Test directory connection in Dashboard
# Go to WorkOS Dashboard → Directory Sync → Test Connection
```

**Integration test:** Create a test user in your directory provider, verify `dsync.user.created` event is received and processed.

## Error Recovery

### "Invalid webhook signature"

**Root cause:** Webhook secret mismatch or signature verification logic error.

Fix:
1. Check `WORKOS_WEBHOOK_SECRET` matches Dashboard value (starts with `whsec_`)
2. Verify SDK signature verification method is called before parsing payload
3. Check webhook payload is passed as raw body (not parsed JSON)

### "Duplicate user creation error"

**Root cause:** Missing idempotency - not using upsert pattern.

Fix:
1. Change `INSERT` to `INSERT ON CONFLICT UPDATE` (or ORM equivalent)
2. Index on `workos_user_id` for fast upsert lookup

### "Users not deleted when directory deleted"

**Root cause:** Only handling `dsync.user.deleted`, missing `dsync.deleted` event.

Fix:
1. Add handler for `dsync.deleted` event
2. Delete ALL users where `organization.workos_directory_id = event.directory_id`
3. Delete ALL groups for that directory
4. Do NOT wait for individual delete events - they won't come

### "Missed events during downtime"

**Root cause:** Webhooks lost, no recovery mechanism.

Fix:
1. Implement Events API polling as backup
2. Store `last_processed_cursor` in database
3. On recovery, poll from last cursor to catch up
4. Combine webhook + polling for reliability

### "Inactive users not handled"

**Root cause:** Only handling hard deletes, not soft deletes.

Fix:
1. Add logic for `dsync.user.updated` where `state = inactive`
2. Soft delete user in your app (mark as inactive, don't hard delete)
3. For post-Oct-2023 environments, also handle `dsync.user.deleted` that follows

### "Event processing timeout"

**Root cause:** Processing events synchronously before returning 200.

Fix:
1. Return 200 immediately after signature verification
2. Queue event for async processing (job queue, background worker)
3. WorkOS will retry if you don't return 200 within timeout

## Related Skills

- workos-authkit-nextjs - for authentication layer
- workos-authkit-react - for client-side auth state
