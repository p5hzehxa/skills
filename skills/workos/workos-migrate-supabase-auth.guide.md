<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Assessment

### Access Confirmation

**Critical decision:** Do you have direct database access to Supabase?

```
Database access?
  |
  +-- YES --> Proceed to Step 3 (SQL export)
  |
  +-- NO  --> STOP. Request admin access or contact Supabase support.
              This migration requires direct database queries.
```

Supabase gives direct database access by default. If blocked, check project permissions.

### Tenant Architecture Detection

**IMPORTANT:** Determine how the current app handles multi-tenancy:

1. Search codebase for `app_metadata` usage
2. Search database for `tenant_id` or similar columns
3. Check for Row Level Security (RLS) policies

**Why this matters:** Supabase has no native organization concept. WorkOS does. You must map tenant logic → WorkOS Organizations or users won't have correct access post-migration.

Common patterns:
- `app_metadata.tenant_id` → map to WorkOS Organization ID
- `tenant_id` column → use as Organization external ID
- RLS policies → will need redesign using WorkOS Organization Memberships

If multi-tenancy exists but you can't identify the pattern, STOP and ask for clarification before importing users.

## Step 3: Export User Data

### SQL Query Location

Run export query in one of:
- Supabase SQL Editor (Dashboard → SQL Editor)
- Database client connected to Supabase Postgres instance

### Export Query

Use the SDK method for querying `auth.users` table. Check fetched docs for exact SQL export query.

**Required columns:**
- `id` (Supabase user UUID)
- `email`
- `encrypted_password` (bcrypt hash)
- `email_confirmed_at` (verification status)
- `phone` (if using phone auth)
- `app_metadata` (tenant/organization mappings)
- `raw_user_meta_data` (social auth provider info)

**Format:** Save as CSV or JSON for import script.

### Password Hash Validation

**Trap:** Some Supabase users may have NULL `encrypted_password`:
- Social auth users who never set a password → NULL is expected
- Email magic link users → NULL is expected
- Password users with NULL → data issue, investigate before migration

Validate:
```bash
# Count users by auth method
grep -c "encrypted_password.*NULL" export.csv  # Social/magic link users
grep -c "encrypted_password.*\$2" export.csv   # Password users
```

## Step 4: Organization Mapping (CRITICAL)

**DO NOT SKIP if app has multi-tenancy.**

### Create Organizations First

Before importing users, create WorkOS Organizations for each tenant:

```
For each unique tenant_id in export:
  1. Create Organization via WorkOS API
  2. Record mapping: Supabase tenant_id → WorkOS org_id
  3. Store mapping in migration script (you'll need it in Step 5)
```

Check fetched docs for Create Organization API endpoint and parameters.

**External ID pattern:** Set `externalId` to Supabase `tenant_id` for future reference.

### Trap: Missing Organization Mappings

If you import users WITHOUT creating Organizations first:
- Users will exist but have no organization membership
- SSO connections won't work
- RBAC will fail
- You'll need to manually fix memberships later

**Verification before Step 5:** Count created Organizations matches unique tenant count in export.

## Step 5: Import Users

### Rate Limiting Strategy

WorkOS Create User API is rate-limited. Check fetched docs for current rate limits.

**Required pattern for large migrations:**
- Batch requests (e.g., 10 users per batch)
- Add delay between batches (e.g., 1 second)
- Implement retry logic for 429 responses

**Do NOT** loop through users without rate limiting. You will hit 429 and corrupt the migration.

### Field Mapping

Map Supabase columns to WorkOS API parameters:

| Supabase Column         | WorkOS Parameter         | Notes                                    |
|-------------------------|--------------------------|------------------------------------------|
| `email`                 | `email`                  | Required                                 |
| `email_confirmed_at`    | `emailVerified`          | true if not NULL, false if NULL          |
| `encrypted_password`    | `password_hash`          | Only if not NULL                         |
| N/A                     | `password_hash_type`     | Set to `'bcrypt'` when passing hash      |
| `phone`                 | `phone`                  | Optional                                 |
| `id`                    | `externalId` (suggested) | Preserve Supabase UUID for FK references |

**Critical:** If `encrypted_password` is NULL, omit `password_hash` and `password_hash_type` parameters. Passing NULL will cause API error.

### Organization Membership

**If Step 4 completed:** For each user, create Organization Membership using the mapping from Step 4.

Check fetched docs for Create Organization Membership API endpoint.

Parameters:
- `userId` (WorkOS user ID from import)
- `organizationId` (WorkOS org ID from Step 4 mapping)
- `roleSlug` (if using RBAC, map from Supabase role data)

**Trap:** Creating user without membership = user can't access app. Always create membership immediately after user creation.

## Step 6: Social Auth Provider Configuration

### Provider Detection

From the export, identify which social providers are in use:

```bash
# Check raw_user_meta_data for provider info
grep -o '"provider":"[^"]*"' export.json | sort | uniq
```

Common providers: `google`, `github`, `microsoft`, `azure`, `slack`

### Provider Setup (REQUIRED)

For each provider found:

1. Navigate to WorkOS Dashboard → Configuration → Authentication
2. Enable the provider
3. Configure OAuth client credentials

**Critical:** WorkOS matches users by email address. The provider must return a verified email for auto-linking to work.

**Trap:** If provider email doesn't match Supabase email exactly (different casing, different domain), auto-linking will fail and create duplicate user. Validate email consistency before enabling provider.

### Email Verification Behavior

WorkOS may require email verification for social auth users depending on provider trust:

- Trusted providers (e.g., Google with gmail.com) → no re-verification
- Unknown providers or domains → verification required

Check fetched docs for list of trusted providers.

**User impact:** Some users may need to verify email on first WorkOS login even if they didn't in Supabase.

## Step 7: Multi-Factor Authentication

### MFA Secret Export Limitation

**CRITICAL LIMITATION:** Supabase does not export TOTP secrets. There is no API or database query to retrieve them.

**User impact:**
- All TOTP MFA users MUST re-enroll after migration
- SMS MFA users MUST switch to TOTP (WorkOS doesn't support SMS MFA due to security concerns)

### Migration Communication

Before cutting over, notify MFA users:
1. Their MFA will be disabled during migration
2. They must re-enroll after first login
3. SMS users must switch to authenticator app

**Alternative:** Offer email-based Magic Auth as substitute for SMS users.

Check fetched docs for MFA enrollment flow and user-facing instructions.

### TOTP Re-Enrollment Pattern

After migration:
1. User logs in with password (no MFA required initially)
2. App detects user should have MFA (from Supabase metadata)
3. Redirect to MFA enrollment flow
4. User scans QR code, confirms enrollment

Do NOT require MFA on first post-migration login — user can't complete it without re-enrolling.

## Verification Checklist (ALL MUST PASS)

Run these checks BEFORE cutting over production traffic:

```bash
# 1. Count users in export vs WorkOS
# Export count:
wc -l < supabase_users.csv
# WorkOS count via API - check fetched docs for list users endpoint

# 2. Verify password users can authenticate
# Create test user with known password, attempt login via WorkOS

# 3. Verify social auth users can authenticate
# Test OAuth flow for each enabled provider

# 4. Check organization memberships exist (if multi-tenant)
# Query memberships API for sample users - check fetched docs for endpoint

# 5. Verify email verification status preserved
# Compare email_confirmed_at from export to emailVerified in WorkOS
```

**Do not cut over until all 5 checks pass.** Failed checks = production auth failures.

## Error Recovery

### "User already exists" during import

**Root cause:** Duplicate email in export OR partial retry of failed import.

**Fix:**
1. Check if user already in WorkOS (query by email)
2. If exists, skip creation but still create Organization Membership if missing
3. Add deduplication logic to import script before retrying

### OAuth auto-linking creates duplicate user

**Root cause:** Email mismatch between Supabase and OAuth provider.

**Fix:**
1. Query WorkOS for user by OAuth provider email
2. If found but email doesn't match Supabase, manually update WorkOS email
3. Re-attempt OAuth login

**Prevention:** Validate email consistency in Step 6 before enabling provider.

### "Invalid password_hash format"

**Root cause:** Passing non-bcrypt hash OR passing empty string instead of omitting parameter.

**Fix:**
1. Validate `encrypted_password` starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefix)
2. If NULL or invalid, omit `password_hash` and `password_hash_type` from request
3. User will need to use password reset flow

### User can log in but gets authorization error

**Root cause:** Organization Membership not created in Step 5.

**Fix:**
1. Query user's WorkOS ID
2. Query user's expected Organization from Step 4 mapping
3. Create missing Organization Membership
4. User must re-login (session refresh)

### Rate limit 429 during import

**Root cause:** Batch delay too short or no delay.

**Fix:**
1. Increase delay between batches (try 2 seconds)
2. Implement exponential backoff on 429
3. Record last successfully imported user ID to resume from correct position

## Post-Migration Cleanup

After successful cutover:

1. **Disable Supabase Auth:** Prevent new users from creating accounts in old system
2. **Monitor WorkOS logs:** Check for authentication failures or unexpected errors
3. **Support MFA re-enrollment:** Provide user instructions and support channel
4. **Validate Organization access:** Spot-check users have correct org memberships
5. **Update app code:** Remove Supabase Auth SDK, update to WorkOS AuthKit SDK

**Do NOT delete Supabase users table** until WorkOS migration is validated for at least 30 days.
