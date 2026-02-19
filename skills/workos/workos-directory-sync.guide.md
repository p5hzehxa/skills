<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth. If this skill conflicts with fetched docs, follow docs.

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users
- https://workos.com/docs/directory-sync/example-apps
- https://workos.com/docs/directory-sync/attributes

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required env vars:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing.

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package exists
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not installed"
```

If not installed, detect package manager and install SDK from fetched Quick Start guide.

### WorkOS Dashboard Setup

User must complete these steps in WorkOS Dashboard (cannot be automated):

1. Create organization (if multi-tenant) or use default
2. Configure directory provider connection (Azure AD, Okta, Google, etc.)
3. Note the directory ID (`directory_[id]`) for testing

**Cannot proceed to implementation without directory ID.**

## Step 3: Event Processing Strategy (Decision Tree)

Choose your integration pattern:

```
How will you receive directory events?
  |
  +-- Real-time required? --> Use Webhooks (Step 4)
  |                          - Push-based
  |                          - Immediate processing
  |                          - Requires public endpoint
  |
  +-- Batch processing OK? --> Use Events API (Step 5)
                              - Pull-based polling
                              - Batch reconciliation
                              - Recovery from missed events
```

**Both approaches are valid.** Webhooks are recommended for real-time ULM, but Events API is fully supported for batch operations or data recovery.

**Critical:** If using webhooks, you MUST verify signatures. If using Events API, you MUST handle pagination.

## Step 4: Webhook Implementation (Real-Time Pattern)

### 4.1: Create Webhook Endpoint

Create route to receive POST requests from WorkOS:

```
POST /webhooks/workos-directory
Content-Type: application/json
Svix-Id: [message-id]
Svix-Signature: [signature]
Svix-Timestamp: [timestamp]
```

**Pattern (pseudocode):**

```
function handleWebhook(request):
  // 1. Extract signature headers (Svix-*)
  headers = extractSvixHeaders(request)
  
  // 2. Get raw body (MUST be raw, not parsed)
  rawBody = request.rawBody
  
  // 3. Verify signature using SDK
  webhookSecret = env.WORKOS_WEBHOOK_SECRET
  event = sdk.webhooks.constructEvent(rawBody, headers, webhookSecret)
  
  // 4. Return 200 immediately (before processing)
  respond(200)
  
  // 5. Process event asynchronously
  processEventAsync(event)
```

**CRITICAL:** Return 200 status BEFORE processing the event. WorkOS will retry if you return non-2xx, causing duplicate processing.

**CRITICAL:** Use raw request body for signature verification. If you parse JSON first, verification will fail.

### 4.2: Signature Verification

**Never skip signature verification in production.** Unverified webhooks are a security vulnerability.

Get webhook secret from WorkOS Dashboard → Webhooks section. Store as `WORKOS_WEBHOOK_SECRET`.

Check fetched docs for exact SDK method name for signature verification (varies by language).

### 4.3: Configure Webhook in Dashboard

In WorkOS Dashboard:

1. Navigate to Webhooks section
2. Add endpoint URL (must be publicly accessible)
3. Select event types to receive (see Step 6 for event catalog)
4. Save webhook secret for signature verification

**Test:** Use Dashboard "Send test event" feature before going live.

## Step 5: Events API Implementation (Polling Pattern)

### 5.1: Polling Pattern

Use SDK method for listing events (check fetched docs for exact method signature):

```
Polling loop pseudocode:
  cursor = null
  
  loop:
    // Fetch events since last cursor
    response = sdk.events.listEvents({
      events: ['dsync.*'],  // All directory sync events
      after: cursor,
      limit: 100
    })
    
    // Process batch
    for event in response.data:
      processEvent(event)
    
    // Update cursor for next iteration
    cursor = response.listMetadata.after
    
    // Wait before next poll (e.g., 30 seconds)
    sleep(30)
```

**CRITICAL:** Store cursor persistently. If process restarts without cursor, you'll reprocess all historical events.

**CRITICAL:** Events API returns data in chronological order. Process in order to avoid race conditions.

### 5.2: Cursor Management

Store cursor in database:

```
Table: event_sync_state
Columns:
  - sync_type: 'directory_sync'
  - last_cursor: [string]
  - last_synced_at: [timestamp]
```

**On startup:** Load cursor from database. If no cursor exists, start from current time (skip historical events) or use `null` to process all history.

### 5.3: Error Recovery

If API call fails:

1. DO NOT update cursor
2. Retry with exponential backoff
3. Log error with cursor value for debugging

Events API is idempotent — safe to reprocess same events.

## Step 6: Event Catalog and Routing

Route events to handlers based on `event.event` property:

```
Event type routing:
  |
  +-- dsync.activated      --> handleDirectoryActivated()
  +-- dsync.deleted        --> handleDirectoryDeleted()
  +-- dsync.user.created   --> handleUserCreated()
  +-- dsync.user.updated   --> handleUserUpdated()
  +-- dsync.user.deleted   --> handleUserDeleted()
  +-- dsync.group.created  --> handleGroupCreated()
  +-- dsync.group.updated  --> handleGroupUpdated()
  +-- dsync.group.deleted  --> handleGroupDeleted()
  +-- dsync.group.user_added   --> handleGroupUserAdded()
  +-- dsync.group.user_removed --> handleGroupUserRemoved()
```

Check fetched "Understanding Events" doc for complete event catalog and payload schemas.

## Step 7: Database Schema Design

### Minimum Viable Schema

```
Table: organizations
  - id (PK)
  - name
  - directory_id (FK to directories.id, nullable)

Table: directories
  - id (PK) - store WorkOS directory_[id]
  - organization_id (FK)
  - state ('active', 'deleted')
  - external_key (provider's identifier)

Table: directory_users
  - id (PK)
  - directory_id (FK)
  - external_id (provider's user ID)
  - email
  - first_name, last_name
  - state ('active', 'inactive')
  - raw_attributes (JSON) - store full payload
  - custom_attributes (JSON) - store custom mappings

Table: directory_groups
  - id (PK)
  - directory_id (FK)
  - external_id (provider's group ID)
  - name
  - raw_attributes (JSON)

Table: directory_group_memberships
  - directory_user_id (FK)
  - directory_group_id (FK)
  - PRIMARY KEY (directory_user_id, directory_group_id)
```

**Key design choices:**

- Store `external_id` for idempotency — use it as natural key for upserts
- Store `raw_attributes` for debugging and audit trail
- Use `state` column instead of hard deletes for `inactive` users
- Use junction table for group memberships (many-to-many)

## Step 8: Implement Event Handlers

### 8.1: Directory Lifecycle Events

#### `dsync.activated`

**Action:** Link directory to organization.

```
Pseudocode:
  directory_id = event.data.id
  org_external_key = event.data.organization_id
  
  // Find or create organization
  org = findOrCreateOrganization(org_external_key)
  
  // Create/update directory record
  upsert directories {
    id: directory_id,
    organization_id: org.id,
    state: 'active',
    external_key: event.data.external_key
  }
```

**TRAP:** Initial sync will trigger this event, followed by `dsync.user.created` for EVERY existing user in directory. Design for bulk processing.

#### `dsync.deleted`

**Action:** Mark directory and all associated data as deleted.

```
Pseudocode:
  directory_id = event.data.id
  
  // Mark directory as deleted
  update directories 
    set state = 'deleted'
    where id = directory_id
  
  // Cascade delete logic (choose one):
  
  // Option A: Hard delete
  delete from directory_group_memberships where directory_user_id in (select id from directory_users where directory_id = directory_id)
  delete from directory_users where directory_id = directory_id
  delete from directory_groups where directory_id = directory_id
  
  // Option B: Soft delete (recommended)
  update directory_users set state = 'deleted' where directory_id = directory_id
  update directory_groups set state = 'deleted' where directory_id = directory_id
```

**CRITICAL TRAP:** `dsync.deleted` does NOT trigger individual `dsync.user.deleted` or `dsync.group.deleted` events. You MUST handle cascade deletion yourself when processing `dsync.deleted`.

**Design decision:** Soft delete (Option B) preserves audit trail. Hard delete (Option A) is simpler but loses history.

### 8.2: User Lifecycle Events

#### `dsync.user.created`

**Action:** Provision user in application.

```
Pseudocode:
  user_data = event.data
  
  upsert directory_users {
    directory_id: user_data.directory_id,
    external_id: user_data.id,  // WorkOS user ID
    email: user_data.email,
    first_name: user_data.first_name,
    last_name: user_data.last_name,
    state: user_data.state,
    raw_attributes: user_data.raw_attributes,
    custom_attributes: user_data.custom_attributes
  }
  
  // Optional: Trigger welcome email, create app user, etc.
  if isNewUser:
    sendWelcomeEmail(user_data.email)
```

**Use upsert** (insert or update) to handle duplicate events safely.

**TRAP:** During initial directory sync, you'll receive `dsync.user.created` for ALL existing users. Rate limit external operations (emails, API calls).

#### `dsync.user.updated`

**Action:** Sync attribute changes.

```
Pseudocode:
  user_data = event.data
  previous = event.data.previous_attributes
  
  // Update user attributes
  update directory_users
    set email = user_data.email,
        first_name = user_data.first_name,
        state = user_data.state,
        custom_attributes = user_data.custom_attributes
    where external_id = user_data.id
  
  // Handle state transitions
  if previous.state == 'active' and user_data.state == 'inactive':
    handleUserDeactivation(user_data)
  
  if previous.state == 'inactive' and user_data.state == 'active':
    handleUserReactivation(user_data)
```

**Check `previous_attributes` field** to see what changed. Useful for triggering conditional logic (e.g., email on role change).

**TRAP:** Most providers use soft delete (state change to `inactive`), not `dsync.user.deleted`. Handle `state: 'inactive'` as deactivation.

**Configuration note:** Check fetched "Handle Inactive Users" doc for retention policy. Post-Oct 2023 environments auto-delete inactive users by default.

#### `dsync.user.deleted`

**Action:** Hard delete user.

```
Pseudocode:
  user_id = event.data.id
  
  // Remove user from database
  delete from directory_group_memberships where directory_user_id in (
    select id from directory_users where external_id = user_id
  )
  delete from directory_users where external_id = user_id
```

**RARE EVENT.** Most deletions come as `dsync.user.updated` with `state: 'inactive'`.

### 8.3: Group Lifecycle Events

#### `dsync.group.created`

**Action:** Create group record.

```
Pseudocode:
  group_data = event.data
  
  upsert directory_groups {
    directory_id: group_data.directory_id,
    external_id: group_data.id,
    name: group_data.name,
    raw_attributes: group_data.raw_attributes
  }
```

**Event ordering:** WorkOS sends `dsync.user.created`, then `dsync.group.created`, then `dsync.group.user_added`. Design for out-of-order delivery if using webhooks.

#### `dsync.group.updated`

**Action:** Update group attributes.

```
Pseudocode:
  group_data = event.data
  
  update directory_groups
    set name = group_data.name,
        raw_attributes = group_data.raw_attributes
    where external_id = group_data.id
```

#### `dsync.group.deleted`

**Action:** Remove group.

```
Pseudocode:
  group_id = event.data.id
  
  delete from directory_group_memberships where directory_group_id in (
    select id from directory_groups where external_id = group_id
  )
  delete from directory_groups where external_id = group_id
```

#### `dsync.group.user_added`

**Action:** Add user to group.

```
Pseudocode:
  group_id = event.data.group.id
  user_id = event.data.user.id
  
  // Find internal IDs
  internal_group_id = findGroupByExternalId(group_id)
  internal_user_id = findUserByExternalId(user_id)
  
  // Create membership (idempotent)
  insert ignore into directory_group_memberships {
    directory_group_id: internal_group_id,
    directory_user_id: internal_user_id
  }
```

**Use idempotent insert** (INSERT IGNORE, ON CONFLICT DO NOTHING) to handle duplicate events.

#### `dsync.group.user_removed`

**Action:** Remove user from group.

```
Pseudocode:
  group_id = event.data.group.id
  user_id = event.data.user.id
  
  internal_group_id = findGroupByExternalId(group_id)
  internal_user_id = findUserByExternalId(user_id)
  
  delete from directory_group_memberships
    where directory_group_id = internal_group_id
      and directory_user_id = internal_user_id
```

## Step 9: Role Mapping (Optional)

If using Directory Sync for RBAC:

### 9.1: Design Role Mapping Strategy

```
Role assignment pattern?
  |
  +-- Group-based roles --> Map groups to app roles
  |                         Example: "Engineering" group → "Developer" role
  |
  +-- Attribute-based roles --> Read role from custom attribute
                                Example: custom_attributes.role = "Admin"
```

Check fetched "Identity Provider Role Assignment" doc for provider-specific attribute mapping.

### 9.2: Implement Group-to-Role Mapping

```
Pseudocode:
  // Define mapping table
  group_role_mappings = {
    "engineering_team": "developer",
    "admin_users": "admin",
    "support_staff": "support"
  }
  
  // On group membership change:
  function updateUserRoles(user_id):
    groups = getGroupsForUser(user_id)
    
    roles = []
    for group in groups:
      if group.name.lower() in group_role_mappings:
        roles.append(group_role_mappings[group.name.lower()])
    
    updateUserRoles(user_id, roles)
```

**Trigger role updates on:**
- `dsync.group.user_added`
- `dsync.group.user_removed`
- `dsync.user.updated` (if user state changes)

### 9.3: Implement Attribute-Based Roles

```
Pseudocode:
  // On user created/updated:
  function syncUserRole(user_data):
    role_attr = user_data.custom_attributes.get('role')
    
    if role_attr:
      updateUserRole(user_data.id, role_attr)
    else:
      // Fallback to default role
      updateUserRole(user_data.id, 'member')
```

**Check custom attribute mapping in WorkOS Dashboard** to see which SCIM attributes map to `custom_attributes` fields.

## Step 10: Testing Strategy

### 10.1: Test with WorkOS Dashboard

Use Dashboard test features:

1. Navigate to Directory Sync → [Your Directory]
2. Manually trigger events using "Simulate Event" feature (if available)
3. Check webhook delivery logs for errors
4. Verify your endpoint returns 200 status

### 10.2: Provider-Specific Testing

If possible, create test directory with real provider:

- **Okta:** Free developer account
- **Azure AD:** Microsoft 365 trial
- **Google:** Google Workspace trial

Test full lifecycle:
1. Create user in provider → Verify `dsync.user.created`
2. Update user → Verify `dsync.user.updated`
3. Add to group → Verify `dsync.group.user_added`
4. Deactivate user → Verify state change
5. Delete connection → Verify `dsync.deleted` handling

### 10.3: Edge Cases to Test

**CRITICAL test cases:**

- **Duplicate events:** Send same event twice → Should be idempotent
- **Out-of-order events:** Group created before users → Should handle gracefully
- **Directory deletion:** Delete connection → Should remove all users/groups
- **Inactive users:** User deactivated → Should update state, not hard delete
- **Large initial sync:** Directory with 1000+ users → Should not timeout/crash
- **Custom attributes:** User with role attribute → Should map correctly

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key valid" || echo "FAIL: API key missing/invalid"

# 2. Check webhook endpoint exists (adjust path)
curl -X POST http://localhost:3000/webhooks/workos-directory -d '{}' -H "Content-Type: application/json" -o /dev/null -w "%{http_code}\n" | grep -q "200\|404" && echo "PASS: Endpoint exists" || echo "FAIL: Endpoint not found"

# 3. Check database schema (example for PostgreSQL)
psql -d yourdb -c "\dt" | grep -q "directory_users\|directory_groups" && echo "PASS: Tables exist" || echo "FAIL: Tables missing"

# 4. Test SDK import (example for Node.js)
node -e "const WorkOS = require('@workos-inc/node'); console.log('PASS: SDK imported')" 2>&1 | grep -q "PASS" && echo "SDK OK" || echo "FAIL: SDK import failed"

# 5. Verify signature verification is implemented (grep for SDK webhook method)
grep -r "constructEvent\|verifySignature" . --include="*.ts" --include="*.js" && echo "PASS: Signature verification found" || echo "FAIL: No signature verification"
```

## Error Recovery

### Webhook Signature Verification Failures

**Root cause:** Using parsed JSON instead of raw body.

**Fix:** Access raw request body before JSON parsing. Framework-specific:
- Express: Use `express.raw()` middleware
- Next.js: Disable body parsing in config
- FastAPI: Access `request.body()` directly

### Duplicate Event Processing

**Root cause:** Non-idempotent handlers or returning non-200 status.

**Fix:**
1. Add `UNIQUE` constraint on `(directory_id, external_id)` in database
2. Use `INSERT ... ON CONFLICT UPDATE` or equivalent upsert
3. Return 200 immediately in webhook handler, before processing

### Events API Cursor Lost

**Root cause:** Process restarted without persisting cursor.

**Fix:**
1. Store cursor in database after each successful batch
2. On startup, load cursor from database
3. If no cursor, decide: process all history (`cursor = null`) or start fresh (`cursor = currentTime`)

### User Already Exists Error

**Root cause:** Trying to INSERT user with duplicate email/external_id.

**Fix:** Use upsert pattern. Check fetched docs for provider-specific constraints — some providers reuse user IDs after deletion.

### Group Not Found During Membership Add

**Root cause:** `dsync.group.user_added` received before `dsync.group.created`.

**Fix:** Store pending memberships and retry after group creation, OR query group from WorkOS API if not in local DB.

### Directory Deleted but Users Remain

**Root cause:** Did not process `dsync.deleted` cascade logic.

**Fix:** Implement cascade deletion in `dsync.deleted` handler (see Step 8.1). Remember: Individual delete events are NOT sent.

### Inactive Users Not Handled

**Root cause:** Only checking for `dsync.user.deleted`, not `state: 'inactive'`.

**Fix:** Handle state changes in `dsync.user.updated`. Treat `inactive` state as soft deletion. Check fetched "Handle Inactive Users" doc for retention policy.

### Rate Limit Hit During Initial Sync

**Root cause:** Sending email/API call for every user during 1000+ user sync.

**Fix:** 
1. Batch external operations
2. Add queue/background job system
3. Detect initial sync pattern (many `dsync.user.created` in short time) and skip non-critical operations

## Related Skills

- **workos-authkit-nextjs** - Combine Directory Sync with AuthKit for complete user management
- **workos-authkit-react** - Frontend integration for authenticated users from Directory Sync
