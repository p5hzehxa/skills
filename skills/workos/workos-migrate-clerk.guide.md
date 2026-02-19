<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access
- Confirm API keys exist in Dashboard → API Keys:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`

### Clerk Export Access

Decision tree for obtaining user data:

```
Do you need password hashes?
  |
  +-- YES --> Use Clerk Backend API (passwordDigest field available)
  |           Rate limit: Check Clerk docs for export API limits
  |
  +-- NO  --> Use Clerk Backend API OR request CSV from Clerk support
              (Support export is faster for large datasets)
```

**Critical:** Clerk does NOT export plaintext passwords. Only bcrypt hashes are available via API.

### WorkOS SDK Installation

Detect package manager, install SDK for your language (check fetched docs for exact package name).

**Verify:** SDK package exists before writing import code.

## Step 3: Export User Data from Clerk

### Using Clerk Backend API

Use Clerk's User API to export user data. Check Clerk docs for:
- Pagination parameters (page size limits)
- Rate limits on list endpoints
- Fields included in User object

**Critical fields to export:**

- `email_addresses` (may contain multiple emails separated by `|`)
- `primary_email_address_id` (needed to determine primary email)
- `first_name`, `last_name`
- `password_digest` (if migrating passwords)

### Multiple Email Addresses (TRAP)

Clerk exports multiple emails as pipe-delimited string: `"john@example.com|john.doe@example.com"`

**Problem:** Export doesn't indicate which is primary.

**Solution:** Fetch User object from Clerk API to get `primary_email_address_id`, then match against full email list.

**Do NOT:** Guess primary email by position or alphabetically — this will break login for users.

### Password Export

If exporting passwords via Clerk API:
- Field name is `password_digest` (NOT `password_hash`)
- Algorithm is bcrypt (WorkOS compatible)
- Digest format includes bcrypt version prefix (e.g., `$2a$10$...`)

**Verify:** Each digest starts with `$2` before importing.

## Step 4: Import Users into WorkOS

### Option A: Use WorkOS Import Tool (Recommended for Large Datasets)

GitHub repo: `https://github.com/workos/migrate-clerk-users`

This tool handles:
- Rate limiting automatically
- Retry logic for failed imports
- Progress tracking

Follow README for environment variables and CSV format requirements.

### Option B: Direct API Import

Use WorkOS User Management API. Check fetched docs for:
- `/user_management/users` endpoint
- Rate limits (important for bulk imports)
- Required vs. optional fields

**Field mapping:**

```
Clerk field           → WorkOS API parameter
--------------------- → --------------------
email_addresses       → email (primary email only)
first_name            → first_name
last_name             → last_name
password_digest       → password_hash (with password_hash_type)
```

**Password import parameters:**

```
password_hash_type: "bcrypt"
password_hash: <value from Clerk password_digest field>
```

### Rate Limit Handling (CRITICAL)

WorkOS rate limits user creation. Check fetched docs for current limits.

**Strategy for large imports:**

1. Batch requests (check docs for max batch size)
2. Implement exponential backoff on 429 responses
3. Track failed imports for retry
4. Do NOT run import in parallel without rate limit logic

**Verification command after import:**

```bash
# Count users in WorkOS (requires API call - check docs for list endpoint)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length'
```

Compare count to Clerk export row count.

## Step 5: Migrate Social Auth Users

### Provider Setup

For each OAuth provider used in Clerk (Google, Microsoft, GitHub, etc.):

1. Navigate to WorkOS Dashboard → Authentication → SSO
2. Configure provider credentials (check fetched docs for provider-specific setup)
3. Verify redirect URIs match your application

**Critical:** WorkOS links social auth users by **email address match**. Users signing in with provider credentials will auto-link to existing WorkOS user IF emails match.

**Trap:** If Clerk user's primary email differs from their OAuth provider email, link will fail. Resolve mismatches BEFORE migration cutover.

### Verification

Test each provider:

```bash
# 1. Trigger OAuth flow for provider
# 2. Check WorkOS Dashboard → Users to confirm user was linked (not created as duplicate)
# 3. Verify user's email matches expected primary email
```

## Step 6: Migrate Organizations

### Export Clerk Organizations

Use Clerk Backend SDK to list organizations. Check Clerk docs for:
- Pagination parameters
- Organization metadata fields available

### Create WorkOS Organizations

Use WorkOS Organization API. Check fetched docs for:
- `/organizations` endpoint
- Required fields (usually just `name`)
- Optional fields (`domains`, `allow_profiles_outside_organization`, etc.)

**Field mapping:**

```
Clerk Organization    → WorkOS Organization
--------------------- → --------------------
id                    → external_id (for tracking)
name                  → name
```

Store Clerk ID as `external_id` or in custom metadata to maintain mapping during migration.

### Migrate Organization Memberships

**Process:**

1. For each Clerk organization, export member list using Clerk Backend SDK
2. Map Clerk user IDs to WorkOS user IDs (use email as join key)
3. Use WorkOS Organization Membership API to add users to organizations

Check fetched docs for:
- `/organization_memberships` endpoint
- Role slug options (if migrating roles from Clerk)
- Batch operations (if available)

**Trap:** Clerk organization roles may not map 1:1 to WorkOS roles. Plan role mapping BEFORE bulk import.

### Verification

```bash
# Count memberships per organization
# (Requires API call - check docs for list endpoint with org filter)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=<ORG_ID>" \
  | jq '.data | length'
```

Compare to Clerk org member counts.

## Step 7: Multi-Factor Auth Migration

### Compatibility Matrix

```
Clerk MFA Type       WorkOS Support    Migration Path
-------------------- ----------------- ----------------------------------
TOTP (authenticator) ✅ Supported      Auto-migrate (same algorithm)
SMS                  ❌ Not supported  Users must re-enroll (email or TOTP)
Email codes          ✅ Supported      Config in WorkOS Dashboard
```

**Critical:** WorkOS does NOT support SMS-based MFA due to security concerns (SIM swapping, SS7 attacks).

### SMS User Migration Strategy

For users with SMS-based MFA in Clerk:

1. **Before cutover:** Email users warning that SMS MFA will be disabled
2. **During cutover:** Import users WITHOUT MFA enrolled
3. **After cutover:** Prompt users to enroll in TOTP or email-based MFA

Check fetched docs for:
- MFA enrollment flows
- MFA challenge configuration

**Do NOT:** Attempt to migrate SMS factors — they will be rejected by WorkOS API.

### TOTP Migration

If Clerk provides TOTP secrets in export:
- WorkOS uses same TOTP algorithm (RFC 6238)
- Secrets can be imported during user creation (check fetched docs for parameter name)

**Trap:** Clerk may NOT export TOTP secrets via API (security policy). If unavailable, users must re-enroll.

## Step 8: Cutover Checklist

Run these checks BEFORE switching production traffic:

```bash
# 1. User count matches
echo "Clerk users: $(clerk-user-count)"
echo "WorkOS users: $(workos-user-count)"

# 2. Test password login for migrated user
# (Manual test - trigger sign-in with known test user)

# 3. Test social auth login
# (Manual test - trigger OAuth flow)

# 4. Verify organizations exist
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations" | jq '.data | length'

# 5. Spot-check org memberships
# (Pick 3 random orgs, verify member counts)
```

**All checks must pass** before DNS/routing changes.

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in import data OR previous partial import.

**Fix:**
1. Check if user already exists in WorkOS (list users, filter by email)
2. If exists with correct data: Skip and continue
3. If exists with wrong data: Update user instead of create (check docs for update endpoint)

### "Invalid password hash" on import

**Root cause:** Password hash format not recognized by WorkOS.

**Fix:**
1. Verify hash starts with `$2` (bcrypt version prefix)
2. Check `password_hash_type` parameter is exactly `"bcrypt"` (case-sensitive)
3. If hash is NOT bcrypt: Cannot import passwords — users must reset

### Rate limit 429 during bulk import

**Root cause:** Exceeding WorkOS rate limits.

**Fix:**
1. Implement exponential backoff (start with 1s delay, double each retry)
2. Reduce batch size or add delay between requests
3. Check fetched docs for current rate limits
4. Consider using WorkOS import tool (handles this automatically)

### Social auth user not linking to existing user

**Root cause:** Email mismatch between OAuth provider and WorkOS user record.

**Fix:**
1. Check user's email in WorkOS Dashboard
2. Check email returned by OAuth provider (log the claims)
3. If mismatch: Update WorkOS user email to match provider email BEFORE migration
4. Re-test OAuth flow after email correction

### Organization membership creation fails

**Root cause:** User or organization doesn't exist yet, OR invalid role slug.

**Fix:**
1. Verify user exists: GET `/user_management/users?email=<EMAIL>`
2. Verify org exists: GET `/organizations/<ORG_ID>`
3. Check role slug against WorkOS docs (exact spelling required)
4. If entities missing: Import order is wrong — users and orgs MUST exist before memberships

### MFA enrollment failing post-migration

**Root cause:** User had SMS MFA in Clerk (not supported in WorkOS).

**Fix:**
1. Confirm user's MFA type in Clerk export
2. If SMS: Expected behavior — prompt user to enroll in TOTP or email
3. Provide clear UI messaging: "SMS authentication is no longer supported. Please set up an authenticator app."

## Related Skills

After migration is complete, integrate WorkOS authentication:

- workos-authkit-nextjs - For Next.js applications
- workos-authkit-react - For React SPAs
- workos-authkit-vanilla-js - For plain JavaScript apps
