---
name: workos-migrate-supabase-auth
description: Migrate to WorkOS from Supabase Auth.
---

<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Source System Capabilities

Supabase gives direct database access to `auth.users` table. This means:
- Password hashes ARE exportable (bcrypt format)
- User metadata IS exportable
- TOTP secrets are NOT exportable (Supabase limitation)
- SMS MFA factors cannot migrate (WorkOS does not support SMS MFA)

### Tenant Architecture Decision Tree

```
Does app use multi-tenancy?
  |
  +-- No --> Skip to Step 3
  |
  +-- Yes --> How is tenancy implemented?
              |
              +-- RLS with tenant_id column --> Extract tenant_id per user
              |
              +-- app_metadata field --> Extract app_metadata.tenant_id per user
              |
              +-- Custom table --> Export user-to-tenant mapping
```

**Output needed:** CSV or JSON with `[user_id, tenant_id, email]` for Step 4.

## Step 3: Export Users from Supabase

### Query Pattern

Use Supabase SQL Editor or database client:

```sql
SELECT
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at
FROM auth.users;
```

**Critical fields:**
- `encrypted_password` - bcrypt hash, required for password migration
- `raw_app_meta_data` - may contain tenant_id or role info
- `email_confirmed_at` - determines if email verified

### Export Format

Save as CSV or newline-delimited JSON. Each row needs:
- Unique identifier (Supabase `id`)
- Email (required for WorkOS)
- Password hash (if migrating passwords)
- Tenant mapping (if multi-tenant)

**Verification:**

```bash
# Check export has required columns
head -1 export.csv | grep -E "id.*email.*encrypted_password"

# Count rows
wc -l export.csv
```

## Step 4: Create WorkOS Organizations (If Multi-Tenant)

**Skip this step if app is single-tenant.**

### For Each Tenant

1. Create Organization via WorkOS API
2. Store mapping: `[tenant_id → organization_id]`

Check fetched docs for exact Create Organization API parameters.

### Pseudocode Pattern

```
For each unique tenant_id in export:
  org = workos.organizations.create({
    name: tenant_name,
    externalId: tenant_id  # Store Supabase tenant_id for reference
  })
  Store mapping: tenant_id → org.id
```

**Verification:**

```bash
# List organizations via WorkOS CLI/API
# Count should match unique tenant_id count from export
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

## Step 5: Import Users into WorkOS

### Rate Limiting Strategy (CRITICAL)

Check fetched docs for current rate limits. Implement batching:

```
Batch size: Start with 10 users/second
For each user in export:
  Import user
  If rate limit error (429):
    Exponential backoff
    Retry
  Sleep to stay under limit
```

### Import Pattern with Password Hashes

Use Create User API. Mapping from Supabase to WorkOS:

| Supabase Field | WorkOS Parameter |
|----------------|------------------|
| `email` | `email` |
| `encrypted_password` | `password_hash` |
| bcrypt (implicit) | `password_hash_type: 'bcrypt'` |
| `email_confirmed_at != null` | `email_verified: true` |

### Pseudocode

```
For each user in export:
  workos.users.create({
    email: user.email,
    emailVerified: user.email_confirmed_at != null,
    passwordHash: user.encrypted_password,
    passwordHashType: 'bcrypt'
  })
  
  # If multi-tenant:
  If user has tenant_id:
    org_id = tenant_mapping[user.tenant_id]
    workos.organizationMemberships.create({
      userId: created_user.id,
      organizationId: org_id
    })
```

Check fetched docs for exact SDK method names and parameter spelling.

### Error Tracking

Log failures with:
- Supabase user ID
- Email
- Error message
- Timestamp

**Verification:**

```bash
# Count imported users
curl -X GET https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# Compare to export count
echo "Export count: $(wc -l < export.csv)"
```

## Step 6: Configure Social Auth Providers

**Skip if no users use social auth.**

### Provider Configuration

1. In WorkOS Dashboard → Redirects → Configure OAuth providers
2. For each provider used in Supabase (Google, Microsoft, GitHub, etc.):
   - Add OAuth client credentials
   - See provider-specific integration docs (check fetched docs for links)

### Auto-Linking Behavior

WorkOS auto-links social auth users by email. User flow after migration:

```
User clicks "Sign in with Google"
  |
  +-- Google returns email
  |
  +-- WorkOS finds existing user with that email
  |
  +-- User signed in (no password needed)
```

**Edge case:** If email NOT verified in WorkOS user record, user may need to verify email first. Check fetched docs for email verification requirements per provider.

## Step 7: Handle MFA Migration

### TOTP Users (Authenticator Apps)

**Critical:** TOTP secrets CANNOT be exported from Supabase.

User experience:
1. User signs in with password (migrated successfully)
2. WorkOS prompts: "Enroll in MFA"
3. User scans QR code with authenticator app

**Preparation:**
- Enable MFA in WorkOS Dashboard → Authentication settings
- Check fetched docs for MFA enrollment flow

### SMS MFA Users

**Critical:** WorkOS does NOT support SMS MFA (security policy).

Migration options:
```
SMS MFA user?
  |
  +-- Switch to TOTP --> User must enroll authenticator app
  |
  +-- Use Magic Auth instead --> Email-based passwordless
```

**Communication needed:** Notify SMS MFA users BEFORE migration that they'll need to switch methods.

## Step 8: Test Migration in Staging

### Test Cases (ALL MUST PASS)

**Password auth:**
```bash
# User with migrated password can sign in
curl -X POST https://api.workos.com/user_management/authenticate \
  -d email=test@example.com \
  -d password=original_supabase_password
# Should return 200 with session token
```

**Organization membership (if multi-tenant):**
```bash
# User is in correct organization
curl -X GET https://api.workos.com/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d userId=user_123
# Check organizationId matches expected tenant
```

**Social auth:**
1. Trigger Google OAuth flow
2. Use email of migrated user
3. Verify auto-linked to existing WorkOS user (not new user created)

**MFA enrollment:**
1. Sign in as TOTP user
2. Verify prompted to enroll MFA
3. Complete enrollment flow

## Step 9: Cutover Checklist

**Do NOT cutover until all pass:**

```bash
# 1. All users imported
test $(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.data | length') -eq $EXPECTED_COUNT

# 2. Sample password logins work
# (Manual test: sign in as 5 random users)

# 3. Organizations created (if multi-tenant)
test $(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length') -eq $EXPECTED_ORG_COUNT

# 4. Social auth providers configured
# (Manual: Dashboard → Redirects shows green checkmarks)

# 5. MFA enabled
# (Manual: Dashboard → Authentication shows MFA toggle on)
```

## Verification Checklist (Post-Migration)

Run these within 24 hours of cutover:

```bash
# 1. No users reporting "invalid password"
# (Monitor support tickets)

# 2. Social auth auto-link rate
# Expected: ~100% (users not creating duplicate accounts)

# 3. MFA re-enrollment rate
# Expected: All previous TOTP users re-enroll within 7 days

# 4. Organization membership gaps
curl -X GET https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | select(.organizationMemberships == []) | .email'
# Should be empty if multi-tenant app
```

## Error Recovery

### "Password hash invalid" during import

**Root cause:** Supabase `encrypted_password` may be null for social-only users.

**Fix:**
```
Skip password_hash parameters if encrypted_password is null:
  workos.users.create({
    email: user.email,
    emailVerified: true
    # No password fields
  })
```

### "User already exists" during import

**Root cause:** Duplicate email in export or partial retry.

**Fix:** Check if user exists before creating:
```
existing = workos.users.list({ email: user.email })
If existing.data.length > 0:
  Skip creation
  Log: "User already migrated"
```

### Rate limit 429 errors

**Root cause:** Importing too fast.

**Fix:**
```
If response.status == 429:
  wait_seconds = 2 ^ retry_count  # Exponential backoff
  Sleep(wait_seconds)
  Retry request
```

Check fetched docs for exact rate limit thresholds.

### Social auth creates NEW user instead of linking

**Root cause:** Email mismatch or email not verified.

**Fix:**
1. Check WorkOS user has `emailVerified: true`
2. Check social provider returns same email format (lowercase, trim whitespace)
3. If mismatch unavoidable, manually link using Update User API (check fetched docs)

### Organization membership missing after import

**Root cause:** Failed organizationMemberships.create call not retried.

**Fix:**
```bash
# Find users without org membership
curl -X GET https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | select(.organizationMemberships | length == 0)'

# Re-run membership creation for those users
```

### MFA users locked out

**Root cause:** User expects SMS MFA but WorkOS doesn't support it.

**Fix:**
1. User resets password (sends email)
2. User signs in with new password
3. User enrolls TOTP MFA

**Proactive:** Email SMS MFA users 7 days before migration with instructions.

## Related Skills

- workos-authkit-nextjs (for implementing auth UI post-migration)
- workos-authkit-react (for implementing auth UI post-migration)
