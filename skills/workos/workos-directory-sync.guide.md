<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:

1. https://workos.com/docs/directory-sync/quick-start
2. https://workos.com/docs/directory-sync/understanding-events
3. https://workos.com/docs/directory-sync/handle-inactive-users
4. https://workos.com/docs/directory-sync/attributes

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Confirm WorkOS SDK package exists in dependency manifest and node_modules (or equivalent for your runtime).

**Verify:** SDK package available before writing imports.

## Step 3: Event Processing Strategy (Decision Tree)

Choose your integration pattern:

```
Processing model?
  |
  +-- Real-time sync (recommended)
  |     |
  |     +-- Use webhooks (Step 4A)
  |     +-- Process events as they arrive
  |     +-- Fast provisioning/deprovisioning
  |
  +-- Batch processing / recovery
        |
        +-- Use Events API polling (Step 4B)
        +-- Fetch events via workos.events.listEvents()
        +-- Good for: data reconciliation, missed event recovery, audit
```

**Both patterns are valid.** Webhooks are push-based (real-time), Events API is pull-based (polling).

**CRITICAL:** You can use BOTH simultaneously — webhooks for real-time, Events API for recovery/reconciliation.

## Step 4A: Webhook Integration (Real-Time)

### Create Webhook Endpoint

Path convention: `/webhooks/workos` or `/api/webhooks/workos`

**Pattern (pseudocode):**

```
POST /webhooks/workos:
  1. Verify signature (SDK method for webhook verification)
  2. Parse event from request body
  3. Return 200 immediately (before processing)
  4. Process event async (see Step 5)
```

**CRITICAL:** Return 200 BEFORE processing event. WorkOS will retry failed webhooks.

### Configure Webhook in Dashboard

Navigate to: WorkOS Dashboard → Webhooks → Add Endpoint

- Enter your webhook URL (must be publicly accessible)
- Select event types (see Step 5 for event taxonomy)
- Save webhook secret to env vars: `WORKOS_WEBHOOK_SECRET`

**Verify:** Send test event from Dashboard, confirm 200 response.

## Step 4B: Events API Integration (Polling)

Use SDK method for listing events (language-specific — check fetched docs).

**Pattern:**

```
Polling loop:
  1. Call SDK method for listEvents() with after cursor
  2. Process events batch (see Step 5)
  3. Store latest event ID as cursor
  4. Wait interval (recommended: 30-60 seconds)
  5. Repeat from step 1
```

**Use cases:**

- Recovering from webhook delivery failures
- Batch synchronization during maintenance windows
- Audit log reconstruction
- Initial backfill of directory data

Check fetched docs for exact method signature and pagination handling.

## Step 5: Event Taxonomy and Handlers

### Directory Lifecycle Events

**`dsync.activated`**

- Fired when: Directory connection established (Dashboard, Admin Portal, or API)
- Action: Store `directory_id` → `organization_id` mapping in your database
- Schema: `{ directory: { id, organization_id, state } }`

**`dsync.deleted`**

- Fired when: Directory connection deleted in WorkOS
- Action: Remove directory → organization mapping, deprovision all users/groups
- **CRITICAL TRAP:** This event does NOT trigger individual `dsync.user.deleted` or `dsync.group.deleted` events
- **You must handle bulk deletion:** Iterate all users/groups for this directory and mark them deleted in your system
- Schema: `{ directory: { id, organization_id, state } }` (state reflects pre-deletion)

### User Lifecycle Events

**`dsync.user.created`**

- Fired when: IT admin creates user in directory provider
- Fired when: Initial directory sync (one event per existing user)
- Action: Upsert user in your database with `directory_id`, `organization_id`
- Schema: Check fetched docs for user attributes (includes email, first_name, last_name, state, custom_attributes)

**`dsync.user.updated`**

- Fired when: User attributes change (standard, auto-mapped, or custom-mapped)
- Schema includes: `previous_attributes` object showing shallow diff
- Action: Update user record in your database
- **CRITICAL:** If `state` changes to `inactive`, this is a soft delete (see Inactive Users section)

**`dsync.user.deleted`**

- Fired when: User hard-deleted from directory provider
- **RARE:** Most providers use soft deletion (`state: inactive`) instead
- Action: Remove user from your database or mark as deleted

### Group Lifecycle Events

**`dsync.group.created`**

- Fired when: Directory group created in provider
- Fired when: Initial directory sync
- **Event ordering:** You will receive `dsync.user.created` → `dsync.group.created` → `dsync.group.user_added`
- Action: Create group record with `directory_id`, `organization_id`

**`dsync.group.updated`**

- Fired when: Group attributes change (name, etc.)
- Schema includes: `previous_attributes` object
- Action: Update group record

**`dsync.group.deleted`**

- Fired when: Group deleted from directory provider
- Action: Remove group or mark as deleted

**`dsync.group.user_added`**

- Fired when: User assigned to group
- Action: Add user → group membership in your database

**`dsync.group.user_removed`**

- Fired when: User removed from group
- Action: Remove user → group membership

## Step 6: Inactive User Handling (Decision Tree)

WorkOS environments created after Oct 19, 2023 have different inactive user behavior:

```
When user moves to state=inactive?
  |
  +-- New environments (post Oct 19, 2023)
  |     |
  |     +-- WorkOS auto-deletes user after grace period
  |     +-- You receive dsync.user.deleted event
  |     +-- Action: Remove user from your system
  |
  +-- Old environments (pre Oct 19, 2023)
  |     |
  |     +-- WorkOS retains user with state=inactive
  |     +-- You receive dsync.user.updated event
  |     +-- Action: Handle in your application (suspend access, mark inactive)
  |
  +-- Custom retention (opt-in via support)
        |
        +-- WorkOS retains inactive users indefinitely
        +-- You receive dsync.user.updated event
        +-- Action: Implement your own retention policy
```

Check with WorkOS support if you need custom inactive user retention.

## Step 7: Role Assignment Integration

**Pattern:**

```
If using role slugs (e.g., "admin", "member"):
  1. Map directory group name → role slug in your database
  2. When dsync.group.user_added fires:
     - Look up group's role slug
     - Assign role to user in your authorization system
  3. When dsync.group.user_removed fires:
     - Remove role from user
```

Check fetched docs for identity provider role assignment patterns — mapping strategies vary by provider (Okta, Azure AD, Google Workspace).

## Step 8: Database Schema (Recommended)

Minimal tables to track directory sync state:

**directories**

- `id` (primary key)
- `workos_directory_id` (unique, indexed)
- `organization_id` (foreign key)
- `state` (active, deleted)

**users**

- `id` (primary key)
- `workos_user_id` (unique, indexed)
- `directory_id` (foreign key)
- `organization_id` (foreign key)
- `email`, `first_name`, `last_name`, `state`
- `custom_attributes` (JSON)

**groups**

- `id` (primary key)
- `workos_group_id` (unique, indexed)
- `directory_id` (foreign key)
- `name`

**group_memberships**

- `user_id` (foreign key)
- `group_id` (foreign key)
- Unique constraint on (user_id, group_id)

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Environment variables present
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Webhook endpoint returns 200 (if using webhooks)
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  -w "\nHTTP Status: %{http_code}\n"
# Expected: HTTP Status: 200

# 3. SDK imported successfully (run in your project's runtime)
# Node.js example:
node -e "const WorkOS = require('@workos-inc/node'); console.log('SDK loaded');"

# 4. Database tables exist (adjust for your database)
psql -c "\d directories" 
psql -c "\d users"
psql -c "\d groups"
```

## Error Recovery

### "Webhook signature verification failed"

- Check: `WORKOS_WEBHOOK_SECRET` matches Dashboard configuration
- Check: Using SDK method for verification (do not implement manually)
- Check: Request body passed to verifier as raw bytes (not JSON-parsed)

### "Directory ID not found" when processing events

**Root cause:** Race condition — event arrived before `dsync.activated` processed.

Fix:

1. Implement retry logic with exponential backoff
2. Process `dsync.activated` events FIRST in your queue
3. Consider using Events API to backfill missed directory creation events

### Events arriving out of order

**Root cause:** Webhooks are delivered in parallel, no ordering guarantee.

Fix:

1. Use upsert patterns (idempotent operations)
2. Store `updated_at` timestamp from events, ignore stale updates
3. Consider Events API for sequential processing if order is critical

### "No dsync.user.deleted events after dsync.deleted"

**This is expected behavior.** When a directory is deleted, WorkOS sends ONLY `dsync.deleted`.

Fix:

1. In your `dsync.deleted` handler, bulk delete all users/groups for that directory
2. Query: `DELETE FROM users WHERE directory_id = ?`
3. Query: `DELETE FROM groups WHERE directory_id = ?`

### Missed webhook events

**Root cause:** Webhook endpoint was down, or delivery failed.

Recovery:

1. Use Events API to poll for missed events
2. Check `created_at` timestamp on events, process any gaps
3. Implement cursor-based pagination to fetch historical events
4. Consider hybrid approach: webhooks for real-time + periodic Events API reconciliation

### "Invalid grant" or "Connection not found"

- Check: Directory connection exists in WorkOS Dashboard
- Check: Connection state is `linked` (not `invalid_credentials`)
- Check: Customer has not revoked access in their directory provider

### Custom attributes not appearing

Check fetched docs for attribute mapping configuration — custom attributes require setup in WorkOS Dashboard or via Admin Portal.

## Related Skills

- workos-authkit-nextjs — For adding authentication to Next.js apps
- workos-authkit-react — For adding authentication to React apps
