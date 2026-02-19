---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

This URL is the source of truth for Auth0 migration. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Assessment

### Decision: Do you need password imports?

```
Password-based auth in Auth0?
  |
  +-- YES --> STOP. Contact Auth0 support FIRST (see Step 3)
  |           This blocks user import by ~1 week minimum
  |
  +-- NO  --> Social auth only? Skip to Step 4
```

**Critical timing:** Auth0 password exports take 1+ weeks. Plan migration timeline accordingly.

### Check WorkOS Environment

Dashboard location: `https://dashboard.workos.com/`

Required configuration:
- Environment created (Production/Staging)
- API key generated (`sk_*` prefix)
- Client ID available (`client_*` prefix)

```bash
# Verify API key works
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1

# Expected: 200 OK with user list (may be empty)
```

## Step 3: Export Auth0 Data (Week 1)

### Standard User Export (All Cases)

In Auth0 Dashboard:
1. Navigate to Extensions → User Import/Export
2. Run "Export Users" job
3. Download newline-delimited JSON file

**Output:** One JSON object per line, NOT a JSON array.

### Password Export (If Needed)

**BLOCKING:** Open Auth0 support ticket requesting password hash export.

Request template:
```
Subject: Password hash export for WorkOS migration
Body: Requesting bcrypt password hashes for all users in [tenant-name].
      Migrating to WorkOS. Need passwordHash field for each user.
```

**Timeline:** 7-14 days typical response time. This determines your migration start date.

**Output:** Second JSON file with `{ "user_id": "...", "passwordHash": "..." }` per line.

## Step 4: Choose Import Method (Decision Tree)

```
Number of users to migrate?
  |
  +-- < 10,000 users --> Option A: WorkOS migration tool (GitHub repo)
  |                       Faster setup, handles batching automatically
  |
  +-- 10,000+ users  --> Option B: Custom script with WorkOS APIs
                          Better control, easier to debug failures
```

### Option A: Migration Tool (Recommended for Most)

**Repository:** `https://github.com/workos/migrate-auth0-users`

Steps:
1. Clone repository
2. Install dependencies (check README for package manager)
3. Set environment variables:
   - `WORKOS_API_KEY`
   - `AUTH0_EXPORT_PATH` (path to user JSON file)
   - `AUTH0_PASSWORD_EXPORT_PATH` (path to password JSON file, if applicable)
4. Run migration script

**Verify:** Script logs successful user count. Cross-check against Auth0 export line count:
```bash
wc -l auth0-users.json
```

### Option B: Custom API Integration

Use WorkOS SDKs. WebFetch SDK docs for your language:
- Node.js: `https://github.com/workos/workos-node`
- Python: `https://github.com/workos/workos-python`
- Ruby: `https://github.com/workos/workos-ruby`

Check fetched docs for exact SDK method signatures — they vary by language.

## Step 5: Map Auth0 Fields to WorkOS

**Source data structure** (from Auth0 export):

```jsonc
// Each line in auth0-users.json
{
  "email": "user@example.com",
  "email_verified": true,
  "given_name": "Jane",
  "family_name": "Doe",
  "user_id": "auth0|507f1f77bcf86cd799439011"
}
```

**Target API:** WorkOS Create User endpoint

Field mapping:
```
Auth0 field       --> WorkOS API parameter
email             --> email
email_verified    --> email_verified
given_name        --> first_name
family_name       --> last_name
```

**Do NOT map `user_id`** — WorkOS generates its own user IDs. Store Auth0 `user_id` separately if you need bidirectional sync during migration.

### Password Hash Mapping (If Applicable)

**Source data structure** (from Auth0 password export):

```jsonc
{
  "user_id": "auth0|507f1f77bcf86cd799439011",
  "passwordHash": "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
}
```

**Target API parameters:**
```
passwordHash      --> password_hash
(fixed value)     --> password_hash_type = "bcrypt"
```

**Critical:** Auth0 uses bcrypt algorithm. Always set `password_hash_type` to `"bcrypt"` when importing hashes.

**Join logic:** Match Auth0 `user_id` from both files to combine user data + password hash in single WorkOS API call.

## Step 6: Import Users

### Pseudocode Pattern

```
FOR EACH line in auth0-users.json:
  1. Parse JSON object
  2. IF password export exists:
       Find matching passwordHash by user_id
  3. Call WorkOS Create User API:
       - Map fields per Step 5
       - IF password exists: include password_hash + password_hash_type
  4. Handle rate limits (429 responses):
       Sleep and retry with exponential backoff
  5. Log success/failure with Auth0 user_id for reconciliation
```

### Rate Limit Handling

WorkOS APIs have rate limits. Check fetched docs for current limits.

**Recovery pattern:**
```
IF response.status == 429:
  retry_after = response.headers["Retry-After"] || 60
  SLEEP(retry_after seconds)
  RETRY request
```

### Verification During Import

Track progress:
```bash
# Count successful imports (adjust based on your logging)
grep "SUCCESS" migration.log | wc -l

# Compare against source
wc -l auth0-users.json
```

## Step 7: Social Auth Provider Configuration

**Scenario:** Users who signed in via Google/Microsoft in Auth0.

### Decision Tree

```
Do Auth0 users have social auth?
  |
  +-- NO  --> Skip to Step 8
  |
  +-- YES --> Which providers?
               |
               +-- Google     --> Configure Google OAuth in WorkOS
               +-- Microsoft  --> Configure Microsoft OAuth in WorkOS
               +-- GitHub     --> Configure GitHub OAuth in WorkOS
               +-- (other)    --> Check /integrations docs
```

**Configuration location:** WorkOS Dashboard → Authentication → Social Connections

**Required from provider:**
- Client ID
- Client Secret
- Redirect URI (WorkOS provides this)

**WebFetch provider setup guides:** Check fetched migration docs for links to provider-specific integration guides.

### Auto-Linking Behavior

After provider configuration, WorkOS auto-links users by **email address** match.

```
User flow:
1. User clicks "Sign in with Google"
2. Google returns email: user@example.com
3. WorkOS finds existing user with user@example.com (from import)
4. WorkOS links social auth identity to that user
5. User signed in — no re-registration
```

**Trap:** Email verification state matters. Check fetched docs for provider-specific verification behavior (e.g., `gmail.com` domains skip verification, but `@company.com` may require it).

## Step 8: Migrate Organizations (If Applicable)

**Skip this step if Auth0 Organizations not used.**

### Export Auth0 Organizations

Use Auth0 Management API. WebFetch: Auth0 Management API docs for Organizations endpoint (URL in fetched migration docs).

**Pagination pattern:**
```
page = 0
WHILE has_more_orgs:
  response = GET /api/v2/organizations?page={page}&per_page=50
  FOR EACH org in response.organizations:
    Store org data
  page += 1
  has_more_orgs = (response.length == 50)
```

### Create WorkOS Organizations

Use WorkOS Create Organization API.

**Field mapping:**
```
Auth0 org field   --> WorkOS API parameter
name              --> name
display_name      --> name (if display_name not set)
id                --> Store separately (WorkOS generates new IDs)
```

**Keep ID mapping:** You'll need Auth0 org ID → WorkOS org ID map for memberships in Step 9.

```bash
# Verify org creation
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations?limit=100 | jq '.data | length'

# Should match Auth0 org count
```

## Step 9: Import Organization Memberships

**Prerequisites:**
- Step 6 complete (users imported)
- Step 8 complete (organizations created)
- ID mappings stored:
  - Auth0 user ID → WorkOS user ID
  - Auth0 org ID → WorkOS org ID

### Data Source

Auth0 "Bulk User Export" includes org memberships in user JSON:
```jsonc
{
  "email": "user@example.com",
  "org_id": "org_abc123",  // Auth0 organization ID
  // ... other fields
}
```

### Pseudocode Pattern

```
FOR EACH user in auth0-users.json:
  IF user has org_id field:
    workos_user_id = id_map.auth0_to_workos_user[user.user_id]
    workos_org_id = id_map.auth0_to_workos_org[user.org_id]
    
    Call WorkOS Create Organization Membership API:
      - user_id: workos_user_id
      - organization_id: workos_org_id
    
    Handle errors (user/org not found means ID mapping issue)
```

Check fetched docs for Organization Membership API endpoint and exact parameters.

## Step 10: Multi-Factor Auth Handling

**Auth0 → WorkOS MFA differences:**

| MFA Type          | Auth0 | WorkOS | Migration Action                                    |
| ----------------- | ----- | ------ | --------------------------------------------------- |
| TOTP (app-based)  | ✓     | ✓      | Users re-enroll (cannot export TOTP secrets)        |
| SMS               | ✓     | ✗      | Users switch to email Magic Auth or TOTP            |
| Email (Magic Auth)| ✓     | ✓      | Supported, no action needed                         |

**Critical:** WorkOS does NOT support SMS-based MFA due to security concerns.

### User Communication

Before migration, notify users with SMS MFA:
```
Subject: Action Required - Update Your Two-Factor Authentication

We're upgrading our authentication system. SMS-based two-factor 
authentication will no longer be available after [DATE].

Please switch to:
- Authenticator app (Google Authenticator, Authy, 1Password)
- Email-based verification

Update your settings: [LINK TO SETTINGS PAGE]
```

**Post-migration:** Users with SMS MFA in Auth0 will need to re-enroll in WorkOS during first sign-in.

## Step 11: Cutover and Verification

### Pre-Cutover Checklist

Run these commands BEFORE switching production traffic:

```bash
# 1. Count imported users
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" | jq '.listMetadata.total'

# Compare against Auth0 export line count
wc -l auth0-users.json

# 2. Test social auth (if configured)
# Attempt sign-in via each provider in test environment
# Verify auto-linking works by checking user email matches imported user

# 3. Verify organization structure (if applicable)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations?limit=1" | jq '.listMetadata.total'

# Compare against Auth0 org count

# 4. Test authentication in staging
# Sign in with test user, verify session works
```

**All counts MUST match** before production cutover.

### Cutover Steps

1. **Parallel run:** Route 5% of traffic to WorkOS, monitor error rates
2. **Increase gradually:** 25% → 50% → 100% over hours/days
3. **Monitor:** Sign-in success rate, API error rates, user support tickets
4. **Rollback plan:** Keep Auth0 connection live for 7 days minimum

### Post-Cutover Verification

```bash
# Monitor sign-in activity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?events=authentication.succeeded&limit=100"

# Check for failed authentications
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/events?events=authentication.failed&limit=100"
```

**Success criteria:**
- Sign-in success rate > 95%
- No spike in support tickets
- Social auth users auto-linking correctly
- Organization memberships enforced

## Error Recovery

### "User already exists" during import

**Cause:** Re-running import script without checking existing users.

**Fix:** Query WorkOS users before import, skip users with matching email:
```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?email=user@example.com"
```

### "Invalid password hash" error

**Root cause:** Incorrect `password_hash_type` or malformed hash string.

**Fix:**
1. Verify `password_hash_type` is exactly `"bcrypt"` (case-sensitive)
2. Verify hash starts with `$2b$` or `$2a$` (bcrypt format)
3. Check hash wasn't truncated during export (should be ~60 characters)

### Social auth users not auto-linking

**Root cause:** Email mismatch or email not verified.

**Debug:**
1. Check user's email in WorkOS: `curl ... /users/{id}`
2. Check provider's returned email in sign-in logs
3. If mismatch: Update user's email in WorkOS to match provider

**Email verification blocking:** Check WorkOS environment settings → Authentication → Email Verification. If "required for all providers", users must verify email even after import.

### Organization membership not enforced

**Cause:** Membership not created or user signed in before membership import.

**Fix:**
1. Query memberships: `curl ... /user_management/organization_memberships?user_id={id}`
2. If missing: Create membership via API
3. User must sign out and back in for membership to take effect

### Rate limit 429 errors during import

**Not an error** — expected for large migrations.

**Pattern:**
```
IF 429 response:
  retry_after = response.headers["Retry-After"]
  SLEEP(retry_after)
  RETRY with exponential backoff (max 5 attempts)
```

Do NOT ignore 429s — they'll cause incomplete imports.

### Auth0 password export delayed/denied

**Cause:** Auth0 support backlog or policy change.

**Workaround:**
1. Import users WITHOUT passwords
2. Use "Forgot Password" flow to let users reset via email
3. Communicate to users: "Set new password at first sign-in"

**Alternative:** Implement password migration on-the-fly (advanced):
- Keep Auth0 connection live temporarily
- On WorkOS sign-in failure, try Auth0 authentication
- If succeeds, import password hash to WorkOS
- Gradually phase out Auth0

Check fetched docs for guidance on hybrid migration patterns.

## Related Skills

After migration complete:
- workos-authkit-nextjs - Integrate AuthKit into Next.js apps
- workos-authkit-react - Integrate AuthKit into React apps
- workos-authkit-vanilla-js - Integrate AuthKit into vanilla JavaScript apps
