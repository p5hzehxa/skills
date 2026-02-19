<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Decision Tree: What Are You Migrating?

```
What Auth0 features are you using?
  |
  +-- Password auth only --> Need password export (contact Auth0 support)
  |
  +-- Social auth (Google/Microsoft) --> No password export needed
  |
  +-- Organizations --> Need Management API pagination
  |
  +-- SMS-based MFA --> INCOMPATIBLE (users must re-enroll)
```

**Critical incompatibility:** Auth0 SMS-based MFA is NOT supported in WorkOS. Users with SMS second factors must switch to email Magic Auth or TOTP authenticators.

### Data You Can Export

From Auth0 "Bulk User Export":
- Email addresses
- Email verification status
- Names (given/family)
- Organization memberships

From Auth0 password export (via support ticket):
- `bcrypt` password hashes (plaintext passwords are NEVER exported)

Auth0 support tickets take 1+ weeks. Start this FIRST if you need password migration.

## Step 3: Export Auth0 Data

### User Data Export

Use Auth0's "Bulk User Export" job (extension in Auth0 dashboard). Output is newline-delimited JSON.

### Password Export (if needed)

Contact Auth0 support to request password hash export. This is a separate file from user data.

**Trap:** Auth0 will NOT provide plaintext passwords. You receive `bcrypt` hashes only.

### Organization Data Export (if needed)

Use Auth0 Management API to paginate organizations:

```bash
# Verify API access works
curl -H "Authorization: Bearer $AUTH0_MGMT_TOKEN" \
  https://$AUTH0_DOMAIN/api/v2/organizations
```

Then paginate through all pages. Check fetched docs for exact endpoint and parameters.

### Organization Membership Export (if needed)

Included in "Bulk User Export" data. No separate export required.

## Step 4: Import Users into WorkOS

### Decision Tree: Import Method

```
How many users?
  |
  +-- < 1000 --> Use WorkOS import tool (GitHub repo)
  |
  +-- 1000+ --> Write custom script using WorkOS APIs
```

WorkOS provides a migration tool at: `https://github.com/workos/migrate-auth0-users`

For custom scripts, use WorkOS Create User API with this field mapping:

```
Auth0 Export Field    --> WorkOS API Parameter
------------------        --------------------
Email                 --> email
Email Verified        --> email_verified
Given Name            --> first_name
Family Name           --> last_name
```

Check fetched docs for exact API endpoint and request schema.

### Importing Passwords (if exported)

Add these parameters to Create User API calls:

- `password_hash_type`: Must be `'bcrypt'`
- `password_hash`: Value from Auth0 `passwordHash` field

**Trap:** Do NOT send password hashes to WorkOS if users signed up via social auth only. These users have no password.

### Social Auth User Migration

Users who signed in via Google/Microsoft/etc can continue using those providers after migration.

**Prerequisites:**
1. Configure the OAuth provider in WorkOS Dashboard (check WorkOS integrations docs for specific provider)
2. Ensure provider client credentials are valid

**Automatic linking:** WorkOS matches social auth users by EMAIL ADDRESS. When a user signs in with Google, WorkOS links to existing WorkOS user with same email.

**Email verification behavior:**
- Trusted providers (e.g., `gmail.com` via Google OAuth) → No extra verification
- Other providers → May require email verification if enabled in WorkOS environment settings

Check fetched docs for which providers are considered trusted.

## Step 5: Migrate Organizations (if using)

### Creating Organizations

Use WorkOS Create Organization API. For each Auth0 organization from Management API export, create matching WorkOS organization.

Check fetched docs for API endpoint and required parameters.

### Adding Organization Memberships

Use WorkOS Organization Membership API to add users to organizations. Membership data comes from Auth0 "Bulk User Export" (same file as user data).

Check fetched docs for API endpoint and required parameters.

## Step 6: Handle MFA Migration

### Decision Tree: MFA Strategy

```
Auth0 MFA type?
  |
  +-- TOTP authenticator --> Users keep existing enrollment
  |
  +-- SMS-based --> INCOMPATIBLE - users must re-enroll
```

**Critical:** SMS-based MFA is NOT supported in WorkOS due to security issues.

**Migration paths for SMS users:**
1. Switch to email-based Magic Auth (passwordless)
2. Re-enroll using TOTP authenticator app

**Trap:** Do NOT assume TOTP enrollments can be imported. Check fetched docs for whether TOTP secrets can be migrated.

## Step 7: Update Application Code

Replace Auth0 SDK calls with WorkOS AuthKit. See `workos-authkit-nextjs`, `workos-authkit-react`, or other AuthKit skills depending on your framework.

**Do NOT attempt to run both Auth0 and WorkOS simultaneously.** This creates auth state conflicts.

## Verification Checklist (ALL MUST PASS)

Run these checks in order. **Do not mark complete until all pass:**

```bash
# 1. Verify import completed
# Count users in WorkOS Dashboard Users page - should match Auth0 export line count
wc -l auth0_export.ndjson  # Compare to WorkOS Dashboard count

# 2. Test password auth (if migrated)
# Attempt login with known Auth0 credentials via WorkOS

# 3. Test social auth (if configured)
# Attempt Google/Microsoft login - should link to existing user by email

# 4. Test organization membership (if migrated)
# Verify user appears in correct WorkOS organization via Dashboard

# 5. Verify application builds
npm run build
```

**If check #1 fails:** Check API rate limits, import script logs, and WorkOS Dashboard for failed user creations.

## Error Recovery

### "Invalid password hash format"

**Cause:** Sending wrong hash type or malformed hash string.

**Fix:**
1. Verify Auth0 export contains `passwordHash` field (requires support ticket export)
2. Verify `password_hash_type` parameter is exactly `'bcrypt'` (not `'bcrypt2'` or other variant)
3. Check hash string includes salt prefix (bcrypt hashes start with `$2a$`, `$2b$`, or `$2y$`)

### "User already exists" during import

**Cause:** Email collision or re-running import script.

**Fix:**
1. Check if user already exists in WorkOS Dashboard
2. If re-importing, use Update User API instead of Create User API
3. Implement idempotency check in import script (query before create)

### Social auth user gets "Email not verified" error

**Cause:** Provider is not in trusted list and email verification is enabled.

**Fix:**
1. Check WorkOS environment settings for email verification toggle
2. If required for compliance, user must verify email via WorkOS
3. Alternatively, manually mark email as verified via WorkOS Dashboard or Update User API

### Organization membership missing after import

**Cause:** Membership API calls failed or wrong organization ID.

**Fix:**
1. Check WorkOS Dashboard for organization - ensure it exists
2. Verify organization ID used in membership API call matches WorkOS organization (NOT Auth0 org ID)
3. Re-run membership creation for affected users

### Auth0 password export takes > 2 weeks

**Cause:** Auth0 support backlog.

**Fix:**
1. Follow up on support ticket with explicit timeline request
2. Consider migrating without passwords first (users reset via email)
3. Import passwords later using Update User API when export arrives

### Users cannot login after migration

**Decision tree:**

```
Login failure type?
  |
  +-- "Invalid credentials" --> Check password hash import (verify bcrypt type)
  |
  +-- "User not found" --> Check email exact match (Auth0 vs WorkOS)
  |
  +-- "Email not verified" --> Check provider trust list or verification settings
  |
  +-- "MFA required" --> Check if TOTP enrollment migrated (may need re-enrollment)
```

### Import script rate limited

**Cause:** WorkOS API rate limits exceeded.

**Fix:**
1. Add exponential backoff to import script
2. Batch users in smaller groups (100-500 per batch)
3. Contact WorkOS support for rate limit increase if importing 10k+ users

## Related Skills

After migration is complete, integrate WorkOS AuthKit:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-react-router
