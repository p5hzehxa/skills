<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Environment

- Confirm `WORKOS_API_KEY` exists (starts with `sk_`)
- Confirm `WORKOS_CLIENT_ID` exists (starts with `client_`)
- Access WorkOS Dashboard to verify environment is active

### Descope Access

- Confirm access to Descope Backend API or Management SDK
- For password migration: open support ticket BEFORE starting user migration
  - **Why:** Descope does NOT expose password hashes via API
  - **Process:** Support generates CSV with hashes + facilitates secure transfer
  - **Required info:** Note which hash algorithm (bcrypt/argon2/pbkdf2) when you receive export

## Step 3: Export Strategy (Decision Tree)

```
User authentication method?
  |
  +-- Passwords only
  |     |
  |     +-- Contact Descope support for password hash export
  |     +-- Wait for CSV delivery before proceeding
  |     +-- Note hash algorithm from support response
  |
  +-- Social auth only (Google/Microsoft/etc.)
  |     |
  |     +-- Export user profiles via Descope API
  |     +-- No password hashes needed
  |     +-- Configure social providers in WorkOS Dashboard
  |
  +-- Mixed (passwords + social)
        |
        +-- Request password export from support
        +-- Export user profiles via API
        +-- Migrate passwords for password users
        +-- Configure social providers for OAuth users
```

### Export Users from Descope

Use Descope Backend API to fetch user data. Key fields to capture:

- `email`
- `givenName`
- `familyName`
- `verifiedEmail`
- User-tenant associations (for organization memberships)

### Export Tenants from Descope (if using B2B model)

Use Descope Management API to fetch tenant data. Key fields:

- `name`
- `id` (store as `external_id` in WorkOS for mapping)

## Step 4: Import Users into WorkOS

### Rate Limiting Strategy

WorkOS Create User API is rate-limited. Check fetched docs for current limits.

**For large migrations:**
- Batch requests with delays between batches
- Implement retry logic with exponential backoff
- Log failed imports for manual review

### Field Mapping

```
Descope          → WorkOS API parameter
email            → email
givenName        → first_name
familyName       → last_name
verifiedEmail    → email_verified
```

### Password Import (if applicable)

**Critical:** Only proceed if you received password export from Descope support.

When calling user creation endpoint, include:

- `password_hash_type`: one of `'bcrypt'`, `'argon2'`, `'pbkdf2'` (matches algorithm from Descope export)
- `password_hash`: the hash value from CSV

**Trap warning:** Do NOT attempt to import passwords without the hash type. The import will fail silently and users won't be able to log in.

### Import Pattern (pseudocode)

```
for each user in descope_export:
  payload = {
    email: user.email,
    first_name: user.givenName,
    last_name: user.familyName,
    email_verified: user.verifiedEmail
  }
  
  if user has password_hash:
    payload.password_hash = user.password_hash
    payload.password_hash_type = algorithm_from_support_export
  
  call workos.userManagement.createUser(payload)
  
  if rate_limit_approached:
    sleep(delay)
```

## Step 5: Migrate Organizations (B2B only)

### Create Organizations

Map Descope tenants to WorkOS Organizations:

```
Descope Tenant   → WorkOS Organization
name             → name
id               → external_id
```

**Why external_id:** Preserves link between systems during migration. Useful for:
- Troubleshooting user membership issues
- Incremental migration (if not doing all-at-once)
- Rollback scenarios

### Add Organization Memberships

After organizations exist, link users to organizations.

**Prerequisites:**
- Organizations created in WorkOS
- Users imported into WorkOS
- Mapping of Descope user-tenant associations

**Critical:** You must have both WorkOS `user_id` and WorkOS `organization_id` before creating memberships. Build lookup maps during import:

```
descope_user_id → workos_user_id
descope_tenant_id → workos_organization_id
```

### RBAC Migration (if using roles)

1. Identify roles in Descope tenant configuration
2. Create equivalent roles in WorkOS Dashboard (Settings → Authorization)
3. During membership creation, specify `role_slug` parameter

**Trap warning:** Role slugs must exist in WorkOS BEFORE creating memberships. Creating memberships with non-existent role slugs will fail.

## Step 6: Social Auth Provider Configuration

For users who sign in via Google/Microsoft/etc.:

1. Navigate to WorkOS Dashboard → Configuration → Social Providers
2. Configure each provider used in Descope (Google, Microsoft, etc.)
3. Enter OAuth client credentials

Check fetched docs for provider-specific setup guides.

### Auto-Linking Behavior

**How it works:** When a social auth user signs in through WorkOS:
- WorkOS matches by email address
- User is automatically linked to existing WorkOS user record
- If email verification is enabled AND provider doesn't verify emails, user must verify

**Email verification bypass:** Known providers (e.g., Google with gmail.com domain) skip extra verification.

## Step 7: Testing Strategy

### Pre-Production Testing

1. Create test users in Descope with known credentials
2. Import test users to WorkOS staging environment
3. Attempt sign-in with:
   - Password (if imported)
   - Social auth (if configured)
4. Verify organization memberships appear correctly

### Production Cutover

```
Migration path?
  |
  +-- All-at-once
  |     |
  |     +-- Schedule maintenance window
  |     +-- Import all users
  |     +-- Switch DNS/config to WorkOS
  |     +-- Monitor error logs
  |
  +-- Incremental (dual-write)
        |
        +-- Import existing users with external_id mapping
        +-- Configure app to create new users in both systems
        +-- Gradually migrate active users
        +-- Final cutover after validation period
```

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration:

```bash
# 1. Verify WorkOS credentials configured
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Test user creation (replace with real email)
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","email_verified":true}'

# 3. List organizations (should return non-empty if B2B)
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# 4. Verify social provider configured (check dashboard)
echo "Check WorkOS Dashboard → Configuration → Social Providers"
```

**Post-migration smoke tests:**
- Sign in with migrated password user
- Sign in with social auth user
- Access organization-scoped resource
- Verify role-based access works

## Error Recovery

### "Password authentication failed" after migration

**Most common causes:**
1. Password hash type mismatch (bcrypt vs argon2 vs pbkdf2)
   - **Fix:** Verify algorithm used in Descope export matches `password_hash_type` in import
2. Hash encoding issue (base64 vs hex)
   - **Fix:** Check Descope export format, ensure no transcription errors

### "Email verification required" for social auth users

**Why it happens:** Provider doesn't guarantee email verification, or email domain not recognized

**Fix options:**
1. Manually verify emails in WorkOS Dashboard
2. Disable email verification in environment settings (not recommended for production)
3. Send verification emails via WorkOS (check fetched docs for email verification API)

### "Organization membership not found"

**Causes:**
- Organization not created before membership
- User not imported before membership
- Role slug doesn't exist

**Fix:**
```bash
# Check organization exists
curl https://api.workos.com/organizations/{org_id} \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Check user exists
curl https://api.workos.com/user_management/users/{user_id} \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# If role-related: verify role exists in Dashboard → Authorization
```

### Rate limit errors (429 Too Many Requests)

**Fix:**
- Reduce batch size
- Add exponential backoff: start at 1s delay, double on each 429
- For large migrations: contact WorkOS support for temporary limit increase

### "User already exists" errors during import

**Scenarios:**
1. Duplicate emails in Descope export
   - **Fix:** Deduplicate before import (keep most recently active)
2. Partial migration retry
   - **Fix:** Query existing users, skip already-imported (use external_id for tracking)

### Social auth user not auto-linking

**Causes:**
- Email mismatch between Descope and provider
- User record not created before first sign-in

**Fix:**
- Verify email in Descope export matches provider email exactly
- Import users BEFORE switching authentication to WorkOS

## Related Skills

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
