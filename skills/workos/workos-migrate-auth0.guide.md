<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration guide is the source of truth. If this skill conflicts with it, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

Audit your Auth0 setup to determine migration scope:

```
Auth0 setup audit?
  |
  +-- Password users? --> YES: Contact Auth0 support for password export (1+ week delay)
  |                       NO:  Skip password import
  |
  +-- Social auth (Google/Microsoft)? --> YES: Configure providers in WorkOS Dashboard
  |                                       NO:  Skip provider setup
  |
  +-- Organizations? --> YES: Export via Auth0 Management API
  |                      NO:  Skip organization migration
  |
  +-- SMS MFA enrolled? --> YES: WARN - Users must re-enroll (WorkOS doesn't support SMS)
                            NO:  TOTP MFA migrates directly
```

**Critical:** Auth0 password export requires support ticket and can take 1+ weeks. Start this FIRST if needed.

## Step 3: Export Auth0 Data

### User Data Export

Use Auth0's [Bulk User Export Extension](https://auth0.com/docs/customize/extensions/user-import-export-extension).

**Output format:** Newline-delimited JSON file with user records.

**Verify export contains:**
- Email
- Email Verified
- Given Name / Family Name
- (Optional) Password Hash (if support ticket was processed)

### Organization Data Export (if applicable)

Use [Auth0 Management API](https://auth0.com/docs/api/management/v2/organizations/get-organizations) to paginate through organizations.

**Extract for each org:**
- Organization ID (for membership mapping)
- Organization name
- Member user IDs

### Password Hash Export (if needed)

**CRITICAL:** Auth0 does NOT include password hashes in standard user export.

You must:
1. Open support ticket with Auth0 requesting password export
2. Wait 1+ weeks for processing
3. Receive separate NDJSON file with `passwordHash` field per user

Auth0 uses `bcrypt` algorithm (WorkOS compatible).

## Step 4: Import Users to WorkOS

### Option A: Use WorkOS Import Tool (Recommended)

GitHub repo: `https://github.com/workos/migrate-auth0-users`

Follow repo README for automated import. This handles the field mapping automatically.

### Option B: Custom Import Script

Use WorkOS Create User API (check fetched docs for endpoint details).

**Field mapping:**

```
Auth0 Export Field  -->  WorkOS API Parameter
-------------------------------------------
Email               -->  email
Email Verified      -->  email_verified
Given Name          -->  first_name
Family Name         -->  last_name
passwordHash        -->  password_hash (if available)
```

**For password import, pass:**
- `password_hash_type`: `'bcrypt'`
- `password_hash`: Value from Auth0's `passwordHash` field

**Pseudocode pattern:**

```
for each user in auth0_export:
  params = {
    email: user.Email,
    email_verified: user["Email Verified"],
    first_name: user["Given Name"],
    last_name: user["Family Name"]
  }
  
  if user.passwordHash exists:
    params.password_hash = user.passwordHash
    params.password_hash_type = 'bcrypt'
  
  workos.createUser(params)
```

Check fetched docs for exact API signature and error handling.

## Step 5: Configure Social Auth Providers

**Only if you have social auth users in Auth0.**

For each provider (Google, Microsoft, etc.):

1. Navigate to WorkOS Dashboard → Integrations
2. Configure provider client credentials
3. Note: WorkOS links users by **email address match**

**Email verification gotcha:**
- Users may need to verify email depending on provider
- Gmail users via Google OAuth: auto-verified (no extra step)
- Other email domains: may require verification step
- Check WorkOS Dashboard → Authentication Settings for current rules

Check [WorkOS integrations page](https://workos.com/integrations) for provider-specific setup.

## Step 6: Migrate Organizations (if applicable)

### Create Organizations in WorkOS

For each Auth0 organization from Management API export:

Use WorkOS Create Organization API (check fetched docs for signature).

**Map:** Auth0 org name → WorkOS org `name` parameter

**Save mapping:** Auth0 org ID → WorkOS org ID (needed for memberships)

### Add Organization Memberships

For each user-to-org relationship from Auth0 export:

Use WorkOS Organization Membership API to link user to organization.

**Pattern:**
```
for each (user_id, org_id) pair in auth0_memberships:
  workos_user_id = lookup_workos_id(user_id)  # from Step 4 import
  workos_org_id = org_mapping[org_id]         # from Create Org step
  workos.createOrganizationMembership(workos_user_id, workos_org_id)
```

Check fetched docs for exact API method.

## Step 7: MFA Migration Strategy

**SMS MFA (Auth0) → NOT SUPPORTED in WorkOS**

Users with SMS-based MFA MUST:
- Re-enroll using TOTP authenticator app, OR
- Switch to email-based Magic Auth

**TOTP MFA:** Migrates directly (no user action required)

**Critical:** Notify affected users BEFORE cutover that SMS MFA will not work and they need to re-enroll.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration:

```bash
# 1. Verify user count matches
# (Compare Auth0 export line count to WorkOS Dashboard user count)
wc -l auth0_users.json
# Then check WorkOS Dashboard → Users → Total count

# 2. Test password login for migrated user
# (Use WorkOS AuthKit sign-in flow with known user credentials)

# 3. Test social auth linking
# (Sign in with Google/Microsoft - should match existing user by email)

# 4. Verify organization memberships
# (Check WorkOS Dashboard → Organizations → [Org Name] → Members)

# 5. Confirm MFA status for TOTP users
# (WorkOS Dashboard → Users → [User] → MFA should show enrolled)
```

**Do not complete migration until all checks pass.**

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in Auth0 export or re-running import script.

Fix:
- Check if user already exists in WorkOS before creating
- Use upsert pattern: try create, catch conflict error, skip or update
- Add idempotency tracking: log each successfully imported user ID

### Password hash import fails with "invalid hash format"

**Root cause:** Auth0 password export may include bcrypt variant WorkOS doesn't recognize, OR hash was truncated.

Fix:
1. Verify `password_hash_type` is exactly `'bcrypt'` (not `'bcrypt-sha256'` or other variant)
2. Check hash string starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
3. If hash is invalid, contact WorkOS support — may need custom import format

### Social auth user not auto-linking

**Root cause:** Email mismatch or email not verified by provider.

Fix:
- Confirm email in WorkOS matches email from social provider exactly (case-sensitive)
- Check WorkOS Dashboard → Authentication Settings → Email verification rules
- User may need to manually verify email first, then social auth will link

### Organization membership API returns 404

**Root cause:** WorkOS user ID or org ID doesn't exist yet.

Fix:
- Ensure user import (Step 4) completed BEFORE adding memberships
- Ensure org creation (Step 6) completed BEFORE adding memberships
- Verify you're using WorkOS IDs, not Auth0 IDs
- Check API response for which resource wasn't found

### SMS MFA users can't sign in post-migration

**Expected behavior:** WorkOS does not support SMS MFA.

Fix:
- Send user notification BEFORE migration with re-enrollment instructions
- Provide self-service flow to enroll in TOTP or Magic Auth
- Consider grace period where users can sign in without MFA, then enforce re-enrollment

### Import script rate limited

**Root cause:** Bulk user creation hitting API rate limits.

Fix:
- Add delay between API calls (e.g., 100ms sleep)
- Batch users into smaller chunks with progress tracking
- Check fetched docs for rate limit specifics
- Contact WorkOS support for temporary rate limit increase during migration

## Related Skills

After migration complete, integrate WorkOS into your application:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
