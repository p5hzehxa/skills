---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch ALL these docs — they are the source of truth:

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

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both present and properly formatted before continuing.

### SDK Installation

Detect package manager (npm/yarn/pnpm), confirm WorkOS SDK is installed.

**Verify:** SDK exists in node_modules or requirements.txt before writing imports.

## Step 3: Choose Event Ingestion Pattern (Decision Tree)

```
Ingestion needs?
  |
  +-- Real-time user lifecycle (add/update/delete) --> Webhooks (recommended)
  |
  +-- Batch processing / reconciliation --> Events API (polling)
  |
  +-- Recover missed events / audit trail --> Events API (pagination)
  |
  +-- Both real-time + audit --> Webhooks + Events API (hybrid)
```

**Both patterns are valid.** Webhooks = push-based. Events API = pull-based.

### Pattern A: Webhooks (Real-Time)

See fetched "understanding-events" doc for webhook setup. You will:

1. Create webhook endpoint in your app
2. Configure webhook URL in WorkOS Dashboard
3. Verify webhook signature on incoming requests
4. Return 200 immediately (process async)

### Pattern B: Events API (Batch/Polling)

Use `workos.events.listEvents()` with filters:

- `events`: specify event types (e.g., `dsync.user.created`)
- `organization_id`: scope to specific org
- `after`: pagination cursor for incremental sync

Check fetched docs for exact method signature and pagination pattern.

### Pattern C: Hybrid (Both)

Use webhooks for real-time updates, Events API for:

- Backfill on connection setup
- Reconcile if webhook delivery fails
- Generate audit reports

## Step 4: Event Type Architecture

All events follow `{domain}.{resource}.{action}` naming:

### Directory Lifecycle Events

- `dsync.activated` - connection established, save directory ID
- `dsync.deleted` - connection torn down

**CRITICAL TRAP:** `dsync.deleted` does NOT trigger individual `dsync.user.deleted` or `dsync.group.deleted` events. When you receive `dsync.deleted`, the directory and ALL its users/groups are gone in one event. Process this as bulk delete in your app.

### User Lifecycle Events

- `dsync.user.created` - new user provisioned
- `dsync.user.updated` - attributes changed (email, name, custom attributes)
- `dsync.user.deleted` - user hard-deleted (rare, see soft delete trap below)

### Group Lifecycle Events

- `dsync.group.created` - new group provisioned
- `dsync.group.updated` - group attributes changed
- `dsync.group.deleted` - group removed
- `dsync.group.user_added` - user added to group
- `dsync.group.user_removed` - user removed from group

Check fetched "understanding-events" doc for complete event catalog.

## Step 5: Soft vs Hard Delete (CRITICAL TRAP)

**Most directory providers use SOFT deletion, not hard deletion.**

When a user is deactivated:

- You receive `dsync.user.updated` (NOT `dsync.user.deleted`)
- Payload includes `state: "inactive"`
- User still exists in WorkOS, just marked inactive

**Decision:** Do you want inactive users deleted automatically?

```
Inactive user handling?
  |
  +-- Delete from app --> Contact WorkOS support to enable auto-delete
  |
  +-- Keep in app (suspended state) --> Handle state: "inactive" in your logic
```

Check fetched "handle-inactive-users" doc for environment-level auto-delete configuration (post Oct 19, 2023 behavior).

## Step 6: Event Handler Pattern (Pseudocode)

Use upsert pattern for resilience (events may arrive out of order or duplicate):

```
on dsync.activated:
  directory_id = event.data.id
  org_id = event.data.organization_id
  UPSERT directory record:
    - link directory_id to org_id
    - mark connection as active
    - save directory.name, directory.type

on dsync.user.created:
  user = event.data
  UPSERT user record:
    - primary key: user.id (NOT email)
    - link to directory_id
    - save email, first_name, last_name, state
    - save custom_attributes if present
  IF this is initial sync:
    skip "new user" email (batch processing)
  ELSE:
    send "getting started" email

on dsync.user.updated:
  user = event.data
  previous = event.data.previous_attributes
  UPSERT user record:
    - update changed attributes only
    - IF state changed to "inactive":
        suspend user access (or delete per Step 5)
  IF email changed:
    send email verification to new address

on dsync.user.deleted:
  user_id = event.data.id
  DELETE user record (hard delete)
  revoke all sessions for user

on dsync.deleted:
  directory_id = event.data.id
  DELETE all users WHERE directory_id = directory_id
  DELETE all groups WHERE directory_id = directory_id
  DELETE directory record
  CRITICAL: No individual user/group delete events will follow
```

**Never use email as primary key** — emails can change. Always use `user.id`.

## Step 7: Group Event Processing Order

**IMPORTANT:** Event order during initial sync:

1. `dsync.user.created` for all users
2. `dsync.group.created` for all groups
3. `dsync.group.user_added` for all memberships

Do NOT assume groups exist before users. Always handle out-of-order events with upserts.

```
on dsync.group.user_added:
  IF user not in local DB:
    log warning, fetch user via SDK (fallback)
  IF group not in local DB:
    log warning, fetch group via SDK (fallback)
  UPSERT group_membership:
    - link user_id to group_id
    - idempotent (safe to receive duplicate events)
```

## Step 8: Webhook Signature Verification (REQUIRED)

If using webhooks, you MUST verify signatures before processing:

```
on incoming webhook:
  1. Extract signature from request headers
  2. Verify signature using SDK method (check fetched docs for exact method)
  3. IF signature invalid:
       return 401, log security warning
  4. Parse event payload
  5. Return 200 immediately (< 5 seconds)
  6. Process event async (queue/background job)
```

Check fetched "quick-start" doc for exact signature verification pattern.

## Step 9: Custom Attributes Handling

User events may include `custom_attributes` object with provider-specific fields.

Types of custom attributes (see fetched "attributes" doc):

- **Standard attributes**: email, first_name, last_name, username (always present)
- **Auto-mapped attributes**: common fields WorkOS maps automatically
- **Custom-mapped attributes**: fields you configure per connection in Dashboard

Store `custom_attributes` as JSON blob or flatten into app schema based on your needs.

```
IF you need specific custom attribute:
  1. Check fetched "attributes" doc for auto-mapped options
  2. IF not auto-mapped:
       configure custom mapping in WorkOS Dashboard
  3. Field will appear in event.data.custom_attributes
```

## Step 10: Initial Sync vs Incremental Updates

When a new directory connection activates:

- You receive `dsync.activated`
- Then hundreds/thousands of `dsync.user.created`, `dsync.group.created` events
- This is **initial sync**, not individual user signups

**Pattern to detect initial sync:**

```
on dsync.activated:
  mark directory as "syncing"
  disable "new user" emails for this directory

on webhook batch or polling:
  IF directory.state == "syncing" AND events slow down:
    mark directory as "active"
    re-enable "new user" emails
```

Alternatively, use Events API to bulk-fetch users after `dsync.activated` instead of processing events individually.

## Step 11: Role Assignment (Optional Feature)

Directory Sync can include role slugs if Identity Provider supports it (e.g., Entra ID).

Check fetched "identity-provider-role-assignment" doc for:

- Which providers support roles
- How to configure role mapping in WorkOS Dashboard
- Where role slug appears in user event payload (check for `custom_attributes.role` or similar)

**Not all providers support roles.** Handle missing role gracefully (default role in your app).

## Step 12: Directory State Management

Track directory connection state in your database:

- `linked` - connection active, events flowing
- `unlinked` - connection paused or deleted
- `invalid_credentials` - directory provider auth failed
- `syncing` - initial sync in progress

Get current state via SDK (check fetched docs for method to fetch directory by ID).

**Critical:** When state changes to `unlinked`, stop processing events for that directory until resolved.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm Directory Sync integration:

```bash
# 1. Environment variables present
grep "WORKOS_API_KEY" .env* && grep "WORKOS_CLIENT_ID" .env*

# 2. SDK imported correctly
grep -r "workos" src/ --include="*.ts" --include="*.js" --include="*.py"

# 3. Event handler exists (adjust path for your app)
ls -la src/**/webhook* src/**/events* app/**/webhook* app/**/events* 2>/dev/null

# 4. Signature verification present (if using webhooks)
grep -r "verifySignature\|verify.*signature" src/ app/ --include="*.ts" --include="*.js" --include="*.py"

# 5. Upsert pattern used (not plain INSERT)
grep -r "upsert\|UPSERT\|ON CONFLICT\|MERGE" src/ app/ --include="*.ts" --include="*.js" --include="*.sql"

# 6. dsync.deleted trap handled
grep -r "dsync.deleted" src/ app/ --include="*.ts" --include="*.js" --include="*.py"
```

**Critical checks:**

- [ ] Signature verification present (webhooks) or auth header (Events API)
- [ ] `dsync.deleted` event deletes ALL users/groups for directory
- [ ] User ID (not email) used as primary key
- [ ] Event handlers use upsert pattern (idempotent)
- [ ] Initial sync does not trigger spam emails

## Error Recovery

### "Webhook signature verification failed"

**Root cause:** Signature validation logic incorrect or using wrong secret.

Fix:

1. Check webhook secret in WorkOS Dashboard matches code
2. Verify using SDK's verification method (check fetched docs)
3. Log raw signature header and payload hash for debugging
4. Ensure webhook endpoint uses HTTPS (required for production)

### "Duplicate users created during initial sync"

**Root cause:** Not using upsert pattern, or using email as primary key.

Fix:

1. Change to upsert logic: `INSERT ... ON CONFLICT (user_id) DO UPDATE`
2. Use `user.id` from event payload as primary key, NOT email
3. Add unique constraint on `user.id` column in database

### "Events arriving out of order"

**Root cause:** This is expected behavior. Webhooks are async, Events API pagination may skip around.

Fix:

1. Use upsert pattern for all event types
2. For delete events, check if resource exists before deleting (idempotent)
3. For group memberships, handle missing user/group with SDK fetch fallback

### "Too many events, webhook timeouts"

**Root cause:** Processing events synchronously in webhook handler.

Fix:

1. Return 200 immediately (< 5 seconds)
2. Queue event to background job (Redis, SQS, etc.)
3. Process event async with retry logic
4. WorkOS will retry if webhook times out, so idempotency is critical

### "User state shows 'inactive' but no delete event"

**Root cause:** Provider uses soft delete (expected behavior, not an error).

Fix:

1. Check fetched "handle-inactive-users" doc for environment config
2. Handle `state: "inactive"` in `dsync.user.updated` event
3. Either suspend user in app or configure auto-delete via WorkOS support

### "Missing custom attributes in events"

**Root cause:** Custom mapping not configured in WorkOS Dashboard.

Fix:

1. Open WorkOS Dashboard → Directory Sync → select connection
2. Configure custom attribute mappings
3. Re-sync directory or wait for next update event
4. Check fetched "attributes" doc for auto-mapped options

### "dsync.deleted received but users still in local DB"

**Root cause:** Not handling `dsync.deleted` as bulk delete.

Fix:

1. When processing `dsync.deleted`, delete ALL users/groups for that directory_id
2. Do NOT wait for individual `dsync.user.deleted` events (they won't come)
3. Use directory_id from event payload to scope delete query

## Related Skills

- **workos-authkit-nextjs**: Authentication layer for directory-synced users
- **workos-authkit-react**: Client-side auth for directory-synced users
