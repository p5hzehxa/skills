<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

- Confirm WorkOS account exists with Dashboard access
- Verify environment variables in `.env`:
  - `WORKOS_API_KEY` - starts with `sk_`
  - `WORKOS_CLIENT_ID` - starts with `client_`
- Check SDK installed in `package.json` or equivalent

### Supabase Access

- Confirm access to Supabase SQL Editor or database client
- Verify read permissions on `auth.users` table
- Test query access: `SELECT COUNT(*) FROM auth.users;`

## Step 3: Export Users from Supabase

### SQL Export Query

Run this in Supabase SQL Editor or your database client:

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
ORDER BY created_at;
```

Export to CSV or JSON for processing.

### Password Hash Format

**CRITICAL:** Supabase stores bcrypt hashes in `encrypted_password`. WorkOS supports bcrypt import, so passwords migrate without user resets.

Unlike Auth0/Cognito, Supabase gives direct database access — no support ticket needed.

### Multi-Tenancy Data

If your app uses multi-tenancy:

- Check `raw_app_meta_data` for tenant IDs or organization identifiers
- Check custom columns (e.g., `tenant_id`, `organization_id` in related tables)
- Map these to WorkOS Organization IDs during import

**Decision Tree for Organizations:**

```
Supabase multi-tenancy implementation?
  |
  +-- RLS with tenant_id column
  |     --> Query user-tenant mappings separately
  |     --> Create WorkOS Organizations from tenant table
  |     --> Use Organization Membership API during import
  |
  +-- app_metadata with org identifiers
  |     --> Parse raw_app_meta_data JSON column
  |     --> Create Organizations first
  |     --> Link users during import via roleSlug
  |
  +-- No multi-tenancy
        --> Import users without organization linkage
```

## Step 4: Create WorkOS Organizations (if applicable)

If migrating multi-tenant data, create Organizations BEFORE importing users.

Use SDK method for creating organizations. Check fetched docs for exact signature.

**Verification:** Query Organizations via Dashboard or SDK to confirm creation before user import.

## Step 5: Import Users into WorkOS

### Rate Limit Strategy

WorkOS Create User API is rate-limited. For large migrations (>1000 users), implement batching:

```
Batch size: 50-100 users per batch
Delay between batches: 1-2 seconds
Monitor for 429 responses, implement exponential backoff
```

Check fetched docs for current rate limits — they vary by environment.

### Field Mapping

Map Supabase export columns to WorkOS Create User API:

```
Supabase Column          --> WorkOS API Parameter
----------------------------------------------------
email                    --> email
encrypted_password       --> password_hash
email_confirmed_at       --> email_verified (boolean)
raw_user_meta_data       --> (custom fields in metadata)
created_at               --> (preserve as metadata if needed)
```

### Password Hash Import

**CRITICAL:** Set these parameters when creating users:

- `password_hash_type`: `'bcrypt'`
- `password_hash`: value from `encrypted_password` column

**Trap:** Do NOT base64-encode the hash. Supabase stores bcrypt hashes as strings — pass them directly.

### Organization Linkage

If user had tenant/org association in Supabase:

1. Create user via Create User API
2. Link to organization via Organization Membership API with appropriate `roleSlug`

Check fetched docs for Organization Membership API signature.

## Step 6: Social Auth Migration

### Provider Configuration

For users who authenticated via Google, Microsoft, GitHub, etc.:

1. Configure each provider in WorkOS Dashboard (Settings → OAuth Providers)
2. Obtain OAuth client credentials from provider
3. Set redirect URIs to WorkOS callback URLs

Check integrations docs for provider-specific setup.

### Automatic Linking

WorkOS matches social auth users by **email address**. When a Google user signs in post-migration:

```
User signs in with Google
  |
  +-- WorkOS receives email from Google
  |
  +-- Searches for existing user with that email
  |
  +-- Automatically links to WorkOS user profile
```

**Trap:** Some providers (like Google with gmail.com domains) are pre-verified. Others may require email verification if enabled in environment settings.

Check Dashboard → Authentication Settings for email verification behavior.

## Step 7: Handle MFA Migration

### TOTP Users

Supabase TOTP secrets **cannot be exported**. Users with TOTP MFA enrolled must re-enroll after migration:

1. User signs in with password (migrated successfully)
2. Prompt user to enroll in MFA via WorkOS enrollment flow
3. User scans new QR code with authenticator app

See fetched docs for MFA enrollment flow.

### SMS Users (Breaking Change)

**CRITICAL:** WorkOS does not support SMS-based MFA due to SIM swap vulnerabilities.

Users with SMS MFA must switch to:

- TOTP-based MFA (authenticator apps), or
- Magic Auth (email-based passwordless)

**Migration communication:** Notify SMS MFA users before migration about required re-enrollment.

## Step 8: Update Application Auth Flows

### Replace Supabase SDK Calls

Map Supabase client methods to WorkOS equivalents:

```
Supabase Pattern                --> WorkOS Pattern
-----------------------------------------------------------------
supabase.auth.signInWithPassword --> AuthKit sign-in redirect flow
supabase.auth.signUp             --> AuthKit sign-up redirect flow
supabase.auth.signOut            --> WorkOS signOut() method
supabase.auth.getSession         --> WorkOS getUser() or withAuth()
```

**Critical:** WorkOS uses redirect-based OAuth flows, not client-side credentials. Update frontend to redirect to AuthKit hosted UI instead of inline forms (unless using headless mode).

For detailed SDK integration, see related skills: workos-authkit-nextjs, workos-authkit-react, etc.

### Session Management

Supabase stores sessions in localStorage. WorkOS uses secure HTTP-only cookies managed by AuthKit middleware.

Remove client-side session storage code — WorkOS handles this automatically.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration success:

```bash
# 1. Confirm user count matches export
# (Use Dashboard or SDK query for user count)
echo "Expected: [COUNT_FROM_SUPABASE]"
echo "Actual: [COUNT_FROM_WORKOS]"

# 2. Test password login for migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d email="test@example.com" \
  -d password="existing_password"
# Should return 200 with user object

# 3. Test social auth redirect (if configured)
# Visit: https://[your-app]/auth/login
# Click "Sign in with Google" — should redirect to Google OAuth

# 4. Verify organization linkage (if applicable)
# Check Dashboard → Users → [test user] → Organizations tab
```

**Do not mark migration complete until password authentication works for sample users.**

## Error Recovery

### "invalid_grant" during password authentication

**Cause:** Password hash not imported correctly.

**Fix:**

1. Check `password_hash_type` was set to `'bcrypt'` during user creation
2. Verify `password_hash` contains the raw `encrypted_password` value (not base64-encoded)
3. Re-import affected users with correct hash parameters

### "Email already exists" during bulk import

**Cause:** Duplicate email in export or partial migration retry.

**Fix:**

1. Implement upsert logic: check if user exists before creating
2. Use Update User API for existing users instead of Create
3. Track imported user IDs to avoid duplicates

### User signs in but has no organization access

**Cause:** Organization Membership not created or incorrect `roleSlug`.

**Fix:**

1. Check Organization Membership API call succeeded during import
2. Verify `roleSlug` matches defined roles in Dashboard
3. Use Dashboard → Users → [user] → Organizations to manually link if needed

### Social auth user creates duplicate account

**Cause:** Email mismatch between Supabase record and OAuth provider email.

**Fix:**

1. Check OAuth provider returns verified email
2. Confirm WorkOS user record has exact email match (case-sensitive)
3. Manually merge accounts via Update User API if needed

### MFA users locked out after migration

**Expected behavior:** TOTP secrets don't migrate — users must re-enroll.

**Mitigation:**

1. Send pre-migration email warning TOTP users
2. Provide clear re-enrollment instructions in app
3. Consider temporary MFA grace period via Dashboard settings

### Rate limit 429 errors during bulk import

**Cause:** Exceeded API rate limit (check fetched docs for current limits).

**Fix:**

1. Reduce batch size (try 50 users per batch)
2. Increase delay between batches (2-3 seconds)
3. Implement exponential backoff on 429 responses
4. Contact WorkOS support for temporary rate limit increase if migrating >100k users

## Post-Migration Cleanup

After confirming successful migration:

1. **Do NOT delete Supabase data immediately** — keep read-only for 30 days as backup
2. Update DNS/environment variables to point to WorkOS endpoints
3. Monitor error logs for authentication issues in first 48 hours
4. Disable Supabase Auth in Dashboard once confident in WorkOS migration

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit in Next.js apps
- workos-authkit-react - Integrate AuthKit in React apps
