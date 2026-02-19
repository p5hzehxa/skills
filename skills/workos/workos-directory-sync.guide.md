<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Directory Provider Connection

Confirm in WorkOS Dashboard:
- Directory connection exists for target organization
- Connection shows `state: "linked"` (not `"invalid_credentials"` or `"unlinked"`)
- Organization ID is known (needed for association)

## Step 3: Event Processing Strategy (Decision Tree)

WorkOS provides TWO patterns for consuming directory events:

```
Processing pattern?
  |
  +-- Real-time sync needed? --> Webhooks (recommended)
  |      - Push-based, low latency
  |      - Webhook endpoint required
  |      - Signature verification mandatory
  |
  +-- Batch processing/reconciliation? --> Events API (polling)
  |      - Pull-based, query with filters
  |      - No webhook endpoint needed
  |      - Use for: recovery, audits, backfills
  |
  +-- Both? --> Webhooks + Events API for recovery
         - Webhooks for real-time
         - Events API to recover missed events
```

**Most common:** Webhooks for real-time + Events API for recovery scenarios.

Check fetched docs for:
- Webhook setup instructions
- Events API query patterns (`workos.events.listEvents()`)
- Signature verification requirements

## Step 4: Event Type Taxonomy

Directory Sync events follow this naming pattern: `dsync.{resource}.{action}`

### Directory Lifecycle

- `dsync.activated` - Connection established (save directory_id → organization_id mapping)
- `dsync.deleted` - Connection torn down (remove all users/groups for this directory)

### User Lifecycle

- `dsync.user.created` - IT admin provisioned user (add to your users table)
- `dsync.user.updated` - User attributes changed (update your users table)
- `dsync.user.deleted` - User hard-deleted (remove from your users table)

### Group Lifecycle

- `dsync.group.created` - Group created in directory
- `dsync.group.updated` - Group metadata changed
- `dsync.group.deleted` - Group removed
- `dsync.group.user_added` - User assigned to group
- `dsync.group.user_removed` - User removed from group

**Event ordering guarantee:** `dsync.user.created` arrives BEFORE `dsync.group.user_added` for the same user.

Check fetched docs for complete event payload schemas.

## Step 5: Critical Directory Deletion Trap

**TRAP:** When `dsync.deleted` fires, you will NOT receive individual `dsync.user.deleted` or `dsync.group.deleted` events for that directory's resources.

**Impact:** If you only handle `dsync.user.deleted`, your database will retain orphaned users after directory deletion.

**Required pattern:**

```
On dsync.deleted:
  1. Extract directory_id from event
  2. Delete ALL users where user.directory_id = directory_id
  3. Delete ALL groups where group.directory_id = directory_id
  4. Remove directory_id → organization_id mapping
```

Do NOT wait for individual deletion events — they will not arrive.

## Step 6: Soft vs Hard User Deletion

Directory providers handle user removal inconsistently:

```
User removed from directory?
  |
  +-- Provider uses soft delete (Azure AD, Okta, Google) 
  |      --> You receive: dsync.user.updated with state = "inactive"
  |      --> User still exists in WorkOS
  |      --> Decision: deactivate in your app OR delete
  |
  +-- Provider uses hard delete (rare)
         --> You receive: dsync.user.deleted
         --> User removed from WorkOS
         --> Must delete from your app
```

**Post-Oct 2023 environments:** WorkOS auto-deletes inactive users after retention period. Check fetched docs for retention policy and opt-out instructions.

**Your implementation must handle BOTH:**
- `dsync.user.updated` with `state: "inactive"` (most common)
- `dsync.user.deleted` (rare, or after retention period)

## Step 7: User Attributes and Custom Mapping

### Standard Attributes

Always present in user payload:
- `id` (WorkOS user ID, prefix `directory_user_`)
- `directory_id` (prefix `directory_`)
- `organization_id` (prefix `org_`)
- `emails` (array, work email typically at index 0)
- `first_name`, `last_name`
- `state` (`"active"` or `"inactive"`)

### Custom Attributes

Identity providers expose additional fields beyond standard attributes. WorkOS supports TWO patterns:

**Auto-mapped attributes:**
- Common fields WorkOS recognizes automatically
- Check fetched docs for list of auto-mapped fields

**Custom-mapped attributes:**
- Customer-specific fields requiring explicit mapping
- Configured per-directory in WorkOS Dashboard
- Available in `custom_attributes` object

**Implementation pattern:**

```
On dsync.user.created or dsync.user.updated:
  1. Extract standard attributes (first_name, emails, etc.)
  2. Check custom_attributes for mapped fields
  3. Upsert to your users table
```

Check fetched docs for complete attribute reference and custom mapping setup.

## Step 8: Role Assignment via Groups

Directory groups can map to application roles using **role slugs**:

```
Directory group               Role slug (you define)
"Sales Team"          -->     "sales_user"
"Engineering Leads"   -->     "eng_manager"
"Admins"              -->     "admin"
```

**Setup (in WorkOS Dashboard):**
1. Navigate to directory connection settings
2. Map directory group name → role slug
3. Save mapping

**Implementation pattern:**

```
On dsync.group.user_added:
  1. Extract user_id, group_id from event
  2. Query group to get mapped role_slug
  3. Assign role_slug to user in your app

On dsync.group.user_removed:
  1. Extract user_id, group_id from event
  2. Query group to get mapped role_slug
  3. Revoke role_slug from user in your app
```

Check fetched docs for role assignment configuration and API methods.

## Step 9: Webhook Verification (CRITICAL if using webhooks)

**SECURITY REQUIREMENT:** Always verify webhook signatures before processing.

WorkOS signs webhook payloads with a secret. Unverified webhooks allow attackers to forge events.

**Pattern:**

```
On webhook POST:
  1. Extract signature from headers
  2. Use SDK signature verification method
  3. If verification fails --> return 401, log incident
  4. If verification succeeds --> process event, return 200
```

**Return 200 immediately after verification** — process events asynchronously. WorkOS retries failed webhooks, so slow processing causes duplicate delivery.

Check fetched docs for exact signature verification method in your SDK.

## Step 10: Initial Sync Behavior

When a directory connection is first established (`dsync.activated`), WorkOS performs a full sync:

**Event flood pattern:**
- `dsync.activated` (1 event)
- `dsync.user.created` (N events, one per existing user)
- `dsync.group.created` (M events, one per existing group)
- `dsync.group.user_added` (K events, one per membership)

**Implementation requirements:**

- **Use upsert logic** — `dsync.user.created` may arrive for users already in your database
- **Process asynchronously** — initial sync can trigger thousands of events
- **Implement idempotency** — WorkOS may retry webhook delivery

Check fetched docs for recommended event processing patterns.

## Step 11: Previous Attributes in Updates

`dsync.user.updated` and `dsync.group.updated` events include a `previous_attributes` object showing changes:

**Pattern:**

```json
{
  "event": "dsync.user.updated",
  "data": {
    "id": "directory_user_123",
    "first_name": "Jane",
    "last_name": "Smith",
    "custom_attributes": {
      "department": "Engineering"
    }
  },
  "previous_attributes": {
    "first_name": "Jane",
    "last_name": "Doe",
    "custom_attributes": {
      "department": null
    }
  }
}
```

**Rules:**
- Only changed fields appear in `previous_attributes`
- `null` in `previous_attributes` means field was added (didn't exist before)
- Useful for audit logs and change detection

Check fetched docs for complete `previous_attributes` behavior.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check env vars are set
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Check SDK is installed (example for Node.js)
npm list @workos-inc/node || echo "SDK not installed"

# 3. If using webhooks, check endpoint responds
curl -X POST http://localhost:3000/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{}' | grep -E "401|200"
# Should return 401 (signature verification required)

# 4. Check directory connection in Dashboard
# Manual: Visit https://dashboard.workos.com/directories
# Verify target directory shows state: "linked"

# 5. Trigger test event in Dashboard
# Manual: Use "Send Test Event" button for directory
# Verify event appears in your logs/database
```

**Integration test pattern:**

1. Create test user in directory provider
2. Verify `dsync.user.created` event received
3. Verify user appears in your database with correct attributes
4. Update user in directory provider
5. Verify `dsync.user.updated` event received with correct `previous_attributes`
6. Delete user in directory provider
7. Verify `dsync.user.updated` (state: inactive) or `dsync.user.deleted` received

## Error Recovery

### "Signature verification failed"

**Root cause:** Webhook signature doesn't match payload.

**Fix:**
1. Check you're using the correct webhook secret from WorkOS Dashboard
2. Verify you're passing the raw request body (not parsed JSON) to verification method
3. Check for proxy/middleware that modifies request body before verification
4. Ensure signature header name matches SDK expectations (check fetched docs)

### "Directory not found" in webhook payload

**Root cause:** Directory was deleted, but webhook was already queued.

**Fix:**
1. Check event type — if `dsync.deleted`, this is expected
2. For other events, query WorkOS API to confirm directory still exists
3. If directory doesn't exist, return 200 and skip processing (idempotency)

### Duplicate events processed

**Root cause:** Webhook retries due to slow response or failure.

**Fix:**
1. Implement idempotency using event ID: `event.id` (prefix `event_`)
2. Store processed event IDs in your database
3. Check event ID before processing — skip if already processed
4. Return 200 immediately after signature verification, process async

### "User already exists" on dsync.user.created

**Root cause:** Initial sync or retry after failed processing.

**Fix:**
1. Use **UPSERT** logic, not INSERT
2. Match on WorkOS user ID (`directory_user_*` prefix), not email
3. Email can change — user ID is immutable

### Missing group memberships after initial sync

**Root cause:** `dsync.group.user_added` events processed before `dsync.user.created`.

**Fix:**
1. Implement a queue with dependency resolution
2. Process user creation events first, then group membership events
3. Or use upsert: create user if not exists when processing membership event

### Orphaned users after directory deletion

**Root cause:** Only handled `dsync.user.deleted`, missed `dsync.deleted` trap.

**Fix:**
1. Add handler for `dsync.deleted` event
2. When received, delete ALL users/groups for that `directory_id`
3. Do NOT wait for individual deletion events (they won't arrive)

### "Invalid state transition" errors

**Root cause:** Processing events out of order.

**Fix:**
1. Ensure webhook endpoint processes events serially per directory
2. Use a queue with directory_id as partition key
3. Or implement state machine that allows idempotent transitions

## Related Skills

- workos-authkit-nextjs - Integrate SSO authentication with directory sync
- workos-authkit-react - Client-side auth UI with synced users
