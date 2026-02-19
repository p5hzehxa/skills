<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Database Access Verification

**Run this command to verify Supabase access:**

```bash
# Test database connection
psql "$SUPABASE_DATABASE_URL" -c "SELECT COUNT(*) FROM auth.users;"
```

If count returns successfully, you have the access needed.

### WorkOS Environment Setup

Check `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Verify WorkOS SDK is installed before writing migration scripts.

## Step 3: Export User Data

### SQL Export Strategy

Access Supabase SQL Editor or use a database client. The `auth.users` table contains all user data.

**Critical fields to export:**

- `id` - Supabase user UUID
- `email` - primary identifier for matching
- `encrypted_password` - bcrypt hash (can be imported directly)
- `email_confirmed_at` - determines if email is verified
- `phone` - optional field
- `raw_user_meta_data` - contains first name, last name, profile data
- `raw_app_meta_data` - may contain tenant IDs or role mappings

Check fetched docs for the complete SQL query with all required fields.

### Password Hash Compatibility

**Key fact:** Supabase uses bcrypt, which WorkOS supports natively. Unlike Auth0 or Cognito, you CAN export and import password hashes without user disruption.

The `encrypted_password` column value can be passed directly to WorkOS with `password_hash_type: 'bcrypt'`.

## Step 4: Multi-Tenancy Mapping (Decision Tree)

Supabase has no native organization concept. How did YOUR app implement multi-tenancy?

```
Multi-tenancy pattern?
  |
  +-- Row Level Security with tenant_id column
  |     --> Map tenant_id values to WorkOS organization IDs
  |     --> Use Organization Membership API to assign users
  |
  +-- Tenant data in app_metadata
  |     --> Parse raw_app_meta_data for tenant references
  |     --> Create WorkOS organizations from unique tenant values
  |
  +-- Single-tenant app
        --> Create one WorkOS organization for all users
```

**Export tenant mapping data now** — you'll need it in Step 6.

## Step 5: Import Users (Rate-Limited Operation)

### Batch Import Pattern

The Create User API is rate-limited. For large migrations, use batching:

```
For each batch of users (50-100):
  1. Call Create User API with user data
  2. Sleep 1 second between batches
  3. Log failed imports for retry
```

Check fetched docs for current rate limits.

### Field Mapping

Map Supabase export fields to WorkOS Create User API parameters:

- `email` → `email`
- `email_confirmed_at` (if not null) → `email_verified: true`
- `encrypted_password` → `password_hash` with `password_hash_type: 'bcrypt'`
- `raw_user_meta_data.first_name` → `first_name`
- `raw_user_meta_data.last_name` → `last_name`

**Trap:** Do NOT pass `id` from Supabase as a WorkOS parameter. WorkOS will generate its own user IDs. Store a mapping between Supabase UUIDs and WorkOS user IDs for data migration.

### Password Import Timing

You can import password hashes:
- During user creation (preferred — one API call)
- After creation using Update User API (if initial import failed)

**Both approaches work** — choose based on error recovery needs.

## Step 6: Organization Assignment

If using WorkOS Organizations (multi-tenant apps):

1. **Create organizations first** using Create Organization API
2. **Assign users to organizations** using Organization Membership API
3. **Map roles** using `roleSlug` parameter if using RBAC

**Command to verify organization creation:**

```bash
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

Should return count > 0 if organizations exist.

## Step 7: Social Auth Configuration

### Email-Based Matching

WorkOS uses **email address** to match social auth sign-ins to existing users. When a user signs in with Google/Microsoft/etc.:

1. WorkOS checks if an account exists with that email
2. If yes, links the social provider to the existing account
3. If no, creates a new user

**No additional code required** — this happens automatically if:
- The provider is configured in WorkOS Dashboard
- The email from the provider matches an imported user's email

### Email Verification Dependency

Some users may need to verify email after social sign-in. This depends on:
- Your environment's email verification settings
- Whether the provider is known to verify emails (e.g., `gmail.com` is trusted)

Check fetched docs for the list of trusted email domains.

## Step 8: Handle MFA Migration (BREAKING CHANGE)

### TOTP MFA

**Supabase TOTP secrets CANNOT be exported.** All TOTP users must re-enroll in MFA after migration.

Migration path:
1. Notify users before migration that MFA re-enrollment is required
2. After migration, prompt users to enroll in MFA again
3. Use WorkOS MFA enrollment UI or API

### SMS MFA (NOT SUPPORTED)

**WorkOS does not support SMS-based MFA** due to SIM swap vulnerabilities.

For users with SMS MFA in Supabase:
- Migrate to TOTP MFA, or
- Use Magic Auth (email-based passwordless) as alternative

**This is a user-facing change** — plan communication before migration.

## Step 9: Enterprise SSO (Optional)

If migrating SSO users, configure SSO connections in WorkOS Dashboard before user sign-in attempts.

Check fetched docs for SSO connection setup — this skill covers user data migration only.

## Verification Checklist (ALL MUST PASS)

**Stop after migration and run these commands:**

```bash
# 1. Verify WorkOS users were created
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should return count matching your Supabase export

# 2. Test password authentication works
# Sign in with an imported user's email and password
# If it succeeds, password hashes imported correctly

# 3. Verify organization assignments (if using orgs)
curl -X GET "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should return count > 0 if users were assigned

# 4. Test social auth provider linking
# Sign in with Google/Microsoft using an imported user's email
# Should link to existing account, not create new user
```

**If any check fails, see Error Recovery below.**

## Error Recovery

### "User with this email already exists"

**Cause:** Attempted to create duplicate user during import.

**Fix:**
1. Check if previous import partially succeeded
2. Query existing WorkOS users: `GET /user_management/users`
3. Resume import from failed batch, skipping existing emails

### "Invalid password hash"

**Cause:** Password hash format doesn't match bcrypt pattern.

**Fix:**
1. Verify Supabase export included `encrypted_password` column
2. Check hash starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefix)
3. If hash is malformed, skip password import for that user — they'll need password reset

### Social auth creates duplicate user instead of linking

**Cause:** Email mismatch between imported user and provider email.

**Fix:**
1. Check email casing matches exactly (WorkOS is case-sensitive for matching)
2. Verify user's email was marked as verified (`email_verified: true` on import)
3. Check WorkOS Dashboard → Users for duplicate entries

### Rate limit errors during import

**Cause:** Exceeded WorkOS API rate limits.

**Fix:**
1. Implement exponential backoff: double sleep time after each 429 response
2. Reduce batch size (try 25 users per batch instead of 100)
3. Check fetched docs for current rate limit values

### "Organization not found" during membership assignment

**Cause:** Attempted to assign user to organization before creating it.

**Fix:**
1. Create all organizations FIRST using Create Organization API
2. Store mapping of organization IDs
3. Then assign users using Organization Membership API

### MFA users can't sign in after migration

**Cause:** TOTP secrets were not migrated (cannot be exported from Supabase).

**Fix:**
1. This is EXPECTED behavior — TOTP secrets cannot be migrated
2. User must re-enroll in MFA using WorkOS enrollment flow
3. Communicate this to users BEFORE migration

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit after migration
- workos-authkit-react - Client-side auth UI for migrated users
