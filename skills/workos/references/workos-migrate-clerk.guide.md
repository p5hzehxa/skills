<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Data Inventory (REQUIRED)

Answer these questions before starting:

```
Do you need to migrate passwords?
  |
  +-- YES --> Contact Clerk support OR use Clerk Backend API
  |           (Plaintext passwords not available in standard export)
  |
  +-- NO  --> Skip Step 3 password export

Do users sign in via social auth (Google, Microsoft)?
  |
  +-- YES --> Note providers used (you'll configure in WorkOS Dashboard)
  |
  +-- NO  --> Skip social auth setup

Do you use Clerk Organizations?
  |
  +-- YES --> Export org data via Clerk Backend SDK
  |
  +-- NO  --> Skip Step 5 org migration

Do users have SMS-based MFA in Clerk?
  |
  +-- YES --> TRAP: WorkOS does not support SMS MFA
  |           Users MUST re-enroll using TOTP or email Magic Auth
  |
  +-- NO  --> MFA will migrate seamlessly
```

**Critical:** SMS MFA users CANNOT be migrated directly. Plan user communication.

## Step 3: Export User Data from Clerk

### Password Export (If Needed)

**Clerk does NOT export plaintext passwords.** You have two options:

1. Contact Clerk support for password hash export
2. Use [Clerk Backend API](https://clerk.com/changelog/2024-10-23-export-users) to export as CSV

Password hashes use `bcrypt` format — compatible with WorkOS.

### User Profile Export

Use Clerk Backend SDK to export user profiles. Standard Clerk export provides:

- `email_addresses` (may contain multiple, pipe-separated)
- `first_name`
- `last_name`
- `password_digest` (if exported separately)

**Trap:** Clerk export does NOT indicate which email is primary if user has multiple. If you need primary email, fetch individual User objects via Clerk API.

## Step 4: Import Users to WorkOS

### Decision: Migration Tool vs Manual API Calls

```
Comfortable running Node.js scripts?
  |
  +-- YES --> Use WorkOS migration tool
  |           https://github.com/workos/migrate-clerk-users
  |
  +-- NO  --> Write custom code using WorkOS User API
```

### Field Mapping

```
Clerk field         --> WorkOS Create User parameter
email_addresses     --> email (see multi-email handling below)
first_name          --> first_name
last_name           --> last_name
password_digest     --> password_hash (with password_hash_type='bcrypt')
```

### Multi-Email Handling (CRITICAL)

Clerk format: `"email_addresses": "john@example.com|john.doe@example.com"`

**Decision tree:**

```
User has multiple emails?
  |
  +-- Need primary email? --> Fetch User object via Clerk API
  |                           (export alone doesn't indicate primary)
  |
  +-- Don't care?        --> Pick first email in pipe-separated list
```

### Password Import

If you exported passwords, include in Create User API call:

- `password_hash_type` = `'bcrypt'`
- `password_hash` = value from Clerk's `password_digest` field

**OR** import passwords later via Update User API.

### Rate Limits (IMPORTANT)

User creation is rate-limited. Check fetched docs for current limits.

**If hitting limits:** Batch imports with delays between calls.

## Step 5: Migrate Social Auth Users

### Provider Setup

For each social provider users signed in with (Google, Microsoft, etc.):

1. Go to WorkOS Dashboard → Integrations
2. Configure provider client credentials
3. Check fetched docs for provider-specific setup

### Automatic Linking

**No manual linking required.** When social auth users sign in via WorkOS:

1. WorkOS receives email from provider
2. WorkOS matches email to existing user
3. User is automatically linked

**Critical:** Email match is case-insensitive but must be EXACT.

### Verification Command

After provider setup, test social auth:

```bash
# Use WorkOS Test Mode to verify provider works
# Check Dashboard logs for successful OAuth callback
```

## Step 6: Migrate Organizations (Optional)

### Export from Clerk

Use [Clerk Backend SDK](https://clerk.com/docs/references/backend/organization/get-organization-list) to:

1. Paginate through organizations
2. For each org, fetch memberships via [Get Organization Membership List](https://clerk.com/docs/references/backend/organization/get-organization-membership-list)

### Create in WorkOS

For each Clerk organization:

1. Call WorkOS Create Organization API
2. Save returned `organization_id`
3. For each membership, call WorkOS Create Organization Membership API with user email + `organization_id`

Check fetched docs for exact API endpoints and parameters.

## Step 7: Handle MFA Migration

### MFA Strategy Differences (CRITICAL)

```
Clerk MFA Type     --> WorkOS Equivalent
TOTP authenticator --> TOTP (seamless migration)
Email codes        --> Email Magic Auth
SMS codes          --> NOT SUPPORTED (security reasons)
```

**If users have SMS MFA:**

1. SMS second factors will NOT migrate
2. Users MUST re-enroll in MFA post-migration
3. Options: TOTP authenticator OR email Magic Auth

**Communication plan required:** Notify SMS MFA users before migration.

### TOTP Migration

TOTP-based MFA (Google Authenticator, Authy, etc.) works in WorkOS. Check fetched docs for MFA enrollment flow.

## Verification Checklist (ALL MUST PASS)

Run these checks BEFORE launching in production:

```bash
# 1. Verify WorkOS API key is set
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS" || echo "FAIL: Key missing or wrong format"

# 2. Test user creation with sample data
# (Use WorkOS SDK in test script - verify 201 response)

# 3. If social auth: Test OAuth flow in WorkOS Dashboard Test Mode
# (Manual verification - check Dashboard logs for successful callback)

# 4. If orgs: Verify org memberships link correctly
# (Query WorkOS API for user's orgs - should match Clerk export)

# 5. If passwords: Test login with migrated password
# (Manual verification - attempt sign-in for test user)
```

**Critical:** Do NOT migrate production users until ALL checks pass.

## Error Recovery

### "User already exists" during import

**Cause:** Re-running import script or email collision.

**Fix:**

1. Check if user already in WorkOS (query by email)
2. If exists, skip creation OR use Update User API to sync fields
3. Add idempotency checks to import script

### "Invalid password_hash format"

**Cause:** Password hash not in bcrypt format OR missing `$2a$`/`$2b$` prefix.

**Fix:**

1. Verify Clerk export contains `password_digest` field
2. Confirm value starts with `$2a$` or `$2b$` (bcrypt markers)
3. If missing, password export from Clerk incomplete — contact Clerk support

### Social auth user not linking automatically

**Cause:** Email mismatch between WorkOS user and provider email.

**Fix:**

1. Query WorkOS for user by email — confirm exact match (case-insensitive)
2. Check provider returns email in OAuth response (some providers don't for unverified emails)
3. Verify provider configured correctly in WorkOS Dashboard

### Rate limit errors during bulk import

**Cause:** Exceeded WorkOS User API rate limit.

**Fix:**

1. Check fetched docs for current rate limit (requests per minute)
2. Add delay between API calls: `sleep 0.1` (bash) or equivalent
3. Use exponential backoff for 429 responses

### Users with multiple emails assigned wrong email

**Cause:** Clerk export doesn't indicate primary email.

**Fix:**

1. Fetch individual User objects via Clerk API to get primary email
2. Update import script to use primary email field
3. OR: Let users update email post-migration via WorkOS User Portal

### "Organization not found" when adding memberships

**Cause:** Organization creation failed OR using wrong `organization_id`.

**Fix:**

1. Verify org was created successfully (query WorkOS by org name)
2. Confirm `organization_id` from create response matches membership call
3. Add error handling to import script — retry org creation if 404

## Migration Launch Checklist

Before switching production traffic to WorkOS:

- [ ] All test accounts migrate successfully
- [ ] Social auth providers tested in WorkOS Dashboard
- [ ] SMS MFA users notified of re-enrollment requirement
- [ ] Rate limits accommodated in import scripts
- [ ] Rollback plan documented (can revert to Clerk if issues)
- [ ] Support team trained on WorkOS authentication flow differences

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
