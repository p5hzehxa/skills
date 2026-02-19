<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration guide is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Inventory Your Supabase Auth Setup

Decision tree for determining migration scope:

```
Supabase Auth Features?
  |
  +-- Email/password only --> Basic migration (Steps 3-5)
  |
  +-- Social auth (Google, Microsoft, etc.) --> Add Step 6
  |
  +-- TOTP MFA --> Users must re-enroll (see Step 7)
  |
  +-- SMS MFA --> Switch to TOTP or Magic Auth (see Step 7)
  |
  +-- Multi-tenancy via RLS/app_metadata --> Add Step 8 (Organizations)
```

### Environment Variables

Check `.env` or environment config for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### WorkOS SDK

Verify SDK is installed before continuing:

```bash
# Check SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || echo "SDK not installed"
```

## Step 3: Export Users from Supabase

### Database Access

Open Supabase SQL Editor or connect a database client to your Supabase project.

### Export Query Pattern

Use this SQL pattern to export users:

```sql
SELECT
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at
FROM auth.users
WHERE deleted_at IS NULL;
```

**Critical fields:**
- `encrypted_password` - bcrypt hash, needed for password import
- `raw_app_meta_data` - may contain tenant IDs for multi-tenancy
- `email_confirmed_at` - determines if email is verified in WorkOS

Export to CSV or JSON for processing.

## Step 4: Map Supabase Fields to WorkOS

### Field Mapping Table

```
Supabase field          --> WorkOS API parameter
==================          ====================
id                      --> (external reference only)
email                   --> email
email_confirmed_at      --> email_verified (true if not null)
encrypted_password      --> password_hash + password_hash_type: 'bcrypt'
raw_user_meta_data      --> (map to first_name, last_name if present)
raw_app_meta_data       --> (extract for Organizations - see Step 8)
```

**Do NOT map:**
- `phone` - WorkOS does not store phone numbers directly
- `id` - WorkOS generates new user IDs

Store Supabase `id` in your application database as external reference if needed for data migration.

## Step 5: Import Users via Create User API

### Rate Limiting Strategy

Check fetched docs for current rate limits. Implement batching:

```
For each batch of users (size = rate limit / 2):
  1. Send Create User API requests
  2. Wait 1 second between batches
  3. Log failed requests for retry
```

### API Request Pattern (Pseudocode)

```typescript
// For each user from Supabase export:
{
  email: supabaseUser.email,
  email_verified: supabaseUser.email_confirmed_at !== null,
  password_hash: supabaseUser.encrypted_password,
  password_hash_type: 'bcrypt',
  first_name: supabaseUser.raw_user_meta_data?.full_name?.split(' ')[0],
  last_name: supabaseUser.raw_user_meta_data?.full_name?.split(' ')[1]
}
```

**Critical:** `password_hash_type` MUST be `'bcrypt'` for Supabase hashes. Check fetched docs for exact parameter names.

### Password Import Timing

Decision tree:

```
When to import password_hash?
  |
  +-- During user creation --> Include password_hash in Create User API
  |
  +-- After user creation --> Use Update User API separately
```

Prefer including password_hash during creation to minimize API calls.

## Step 6: Handle Social Auth Users (If Applicable)

### Provider Configuration

For each OAuth provider used in Supabase (Google, Microsoft, etc.):

1. Navigate to WorkOS Dashboard → Configuration → Auth Methods
2. Enable the provider
3. Configure client credentials (see provider-specific integration docs)

**Provider docs:** Check https://workos.com/docs/integrations for provider setup

### Email Matching Behavior

After provider configuration, WorkOS automatically links social auth users by email address match.

**Trap:** Some users may need to verify email if:
- Email verification is enabled in your WorkOS environment
- The provider is not known to verify emails (e.g., custom OAuth providers)

Known-verified providers (e.g., Google with gmail.com) skip extra verification.

## Step 7: Multi-Factor Authentication Transition

### TOTP-Based MFA

**Critical limitation:** TOTP secrets CANNOT be exported from Supabase.

Users with TOTP enrolled must:
1. Complete password/social migration first
2. Re-enroll TOTP after first WorkOS login

**Migration communication:** Notify users before migration that they must re-enroll MFA.

### SMS-Based MFA

**WorkOS does not support SMS MFA** due to SIM swap vulnerabilities.

Alternatives for SMS users:
- Migrate to TOTP authenticator apps
- Use email-based Magic Auth (passwordless)

See related skill: `workos-authkit-base` for Magic Auth setup.

## Step 8: Organizations and Multi-Tenancy (If Applicable)

### Detecting Multi-Tenancy

Check if Supabase export includes tenant information:

```
Multi-tenancy pattern?
  |
  +-- tenant_id in app_metadata --> Extract and map to Organizations
  |
  +-- RLS policies with tenant column --> Query your app DB for user-tenant relationships
  |
  +-- No multi-tenancy --> Skip this step
```

### Create Organizations Pattern (Pseudocode)

```typescript
// 1. Extract unique tenant IDs from Supabase export
const tenantIds = [...new Set(users.map(u => u.raw_app_meta_data?.tenant_id))];

// 2. Create Organization for each tenant
for (const tenantId of tenantIds) {
  // Use Create Organization API
  {
    name: tenantId, // or lookup tenant name from your app DB
    domains: [], // add if you have domain verification
    // Check fetched docs for additional parameters
  }
  // Store WorkOS org_id -> tenantId mapping
}
```

### Add Users to Organizations

After creating Organizations, use Organization Membership API:

```
For each user:
  1. Lookup WorkOS org_id from tenantId mapping
  2. Create membership via API
  3. Assign roleSlug if using roles (optional)
```

Check fetched docs for exact Organization Membership API parameters.

## Step 9: Replace Supabase Auth SDK Calls

### Code Migration Pattern

Identify all Supabase auth calls in your codebase:

```bash
# Find Supabase auth usage
grep -r "supabase.auth" . --include="*.ts" --include="*.tsx" --include="*.js"
```

Replace with WorkOS AuthKit:

```
Supabase Pattern                    --> WorkOS Equivalent
============================            ==================
supabase.auth.signInWithPassword    --> AuthKit sign-in UI or API
supabase.auth.signUp                --> AuthKit sign-up UI or API
supabase.auth.getUser()             --> getUser() from AuthKit SDK
supabase.auth.signOut()             --> signOut() from AuthKit SDK
supabase.auth.onAuthStateChange     --> AuthKit session management
```

**See related skills:**
- `workos-authkit-nextjs` - For Next.js integration
- `workos-authkit-react` - For React integration
- `workos-authkit-vanilla-js` - For vanilla JavaScript

## Step 10: Enterprise SSO Configuration (Optional)

If migrating to WorkOS specifically for Enterprise SSO:

1. Navigate to WorkOS Dashboard → Configuration → SSO
2. Configure SAML/OIDC connections per customer organization
3. Test SSO flow before full cutover

Check fetched docs for SSO setup procedures and connection configuration.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. Verify WorkOS SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK missing"

# 2. Check environment variables set
env | grep WORKOS_API_KEY || echo "FAIL: API key not set"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Client ID not set"

# 3. Verify no Supabase auth imports remain
grep -r "supabase.auth" . --include="*.ts" --include="*.tsx" --include="*.js" 2>/dev/null && echo "FAIL: Supabase auth calls found"

# 4. Test WorkOS authentication endpoint
curl -X GET "https://api.workos.com/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" | grep -q "data" && echo "PASS: API accessible" || echo "FAIL: API error"

# 5. Application builds successfully
npm run build
```

**Pre-production testing:**
1. Create test user via WorkOS API
2. Verify test user can sign in
3. Verify password authentication works (if migrated with hashes)
4. Verify social auth works (if configured)
5. Verify organization membership (if using multi-tenancy)

## Error Recovery

### "Invalid password hash" during import

**Root cause:** Password hash format mismatch or corruption during export.

Fix:
1. Verify `encrypted_password` values are valid bcrypt hashes (start with `$2a$`, `$2b$`, or `$2y$`)
2. Check `password_hash_type` is exactly `'bcrypt'` in API request
3. If hash is corrupted, force password reset for affected users

### "Email already exists" during user creation

**Root cause:** Duplicate import attempt or user already exists in WorkOS.

Decision tree:

```
Error: Email already exists
  |
  +-- First import attempt --> Check for duplicate emails in Supabase export
  |
  +-- Retry after failure --> Skip user, mark as already imported
  |
  +-- Concurrent imports --> Implement idempotency check before API call
```

### Rate limit exceeded (429 response)

**Root cause:** Batching too aggressive or rate limit changed.

Fix:
1. Check fetched docs for current rate limits
2. Increase delay between batches
3. Reduce batch size
4. Implement exponential backoff for retries

### Social auth users cannot sign in

**Root cause:** Provider not configured or email mismatch.

Fix:
1. Verify provider is enabled in WorkOS Dashboard
2. Verify client credentials are correct
3. Check email from provider matches migrated user email exactly (case-sensitive)
4. Enable email verification bypass if provider is trusted

### "Organization not found" when creating memberships

**Root cause:** Organization creation failed or wrong org_id used.

Fix:
1. Verify Organization creation succeeded (check API response)
2. Verify org_id mapping is correct
3. Use List Organizations API to confirm organization exists

### TOTP MFA not working after migration

**Expected behavior:** TOTP secrets cannot be migrated.

Fix:
1. User must re-enroll TOTP after first WorkOS login
2. Direct users to MFA enrollment flow in your app
3. Consider grace period where MFA is optional post-migration

### "Unauthorized" API errors

**Root cause:** Invalid API key or insufficient permissions.

Fix:
1. Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_`)
2. Check key is for correct environment (test vs production)
3. Verify key has User Management permissions in Dashboard

## Related Skills

- `workos-authkit-nextjs` - Integrate AuthKit with Next.js after migration
- `workos-authkit-react` - Integrate AuthKit with React after migration
- `workos-authkit-vanilla-js` - Integrate AuthKit with vanilla JavaScript after migration
