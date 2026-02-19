<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Planning

### Architecture Decision: Organizations

**CRITICAL:** Supabase has no native organization concept. Map your existing multi-tenancy pattern:

```
Current Supabase pattern?
  |
  +-- RLS policies with tenant_id column
  |     → Extract tenant_id values
  |     → Create WorkOS Organizations with those IDs
  |     → Map users to orgs via Organization Membership API
  |
  +-- app_metadata tenant field
  |     → Parse app_metadata.tenant_id from user export
  |     → Create WorkOS Organizations
  |     → Use Create Organization Membership API
  |
  +-- No multi-tenancy
        → Skip organization creation
        → Import users directly
```

**Decision impact:** If you skip organization mapping, you'll need to refactor your access control logic later. Plan this NOW.

### MFA Migration Limitations (BLOCKING)

**TRAP:** Supabase does not expose TOTP secrets for export. Users with MFA WILL need to re-enroll.

```
Supabase MFA type?
  |
  +-- TOTP (authenticator apps)
  |     → Users must re-enroll after migration
  |     → Plan communication: "Please set up MFA again"
  |
  +-- SMS-based Phone MFA
        → WorkOS does NOT support SMS MFA (security policy)
        → Redirect users to TOTP or Magic Auth
        → Plan communication: "MFA method changed"
```

**Action:** Draft user communication NOW before export. Do not surprise users post-migration.

## Step 3: Export Supabase Data

### Direct Database Access

Supabase gives you direct SQL access (unlike Auth0/Cognito). Use [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview#the-sql-editor) or your preferred database client.

**Export query structure:**

```sql
SELECT
  id,                    -- User identifier
  email,                 -- Email address
  encrypted_password,    -- bcrypt hash (WorkOS compatible)
  email_confirmed_at,    -- Email verification timestamp
  phone,                 -- Phone number if present
  raw_user_meta_data,    -- Custom user attributes
  raw_app_metadata       -- Tenant mapping if you use app_metadata pattern
FROM auth.users;
```

**CRITICAL:** `encrypted_password` column contains bcrypt hashes. WorkOS supports bcrypt natively — do NOT attempt to decrypt or re-hash.

### Extract Tenant Mapping (if applicable)

If using `app_metadata` for multi-tenancy:

```sql
SELECT
  id,
  email,
  raw_app_metadata->>'tenant_id' as tenant_id
FROM auth.users
WHERE raw_app_metadata->>'tenant_id' IS NOT NULL;
```

**Verify export completeness:**

```bash
# Count exported rows vs Supabase dashboard user count
wc -l exported_users.csv
# Should match Supabase Dashboard > Authentication > Users total
```

## Step 4: Create WorkOS Organizations (if needed)

**Skip this step if:** No multi-tenancy or users all belong to single org.

Use tenant IDs from Step 3 export. Check fetched docs for Create Organization API parameters.

**Pattern (pseudocode):**

```
FOR EACH unique tenant_id IN export:
  CREATE WorkOS Organization with:
    - name: tenant_id (or lookup friendly name from your DB)
    - unique identifier for mapping
```

**Verify:**

```bash
# List organizations via API
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
# Count should match unique tenant_id values from export
```

## Step 5: Import Users

Use Create User API for each exported user. Check fetched docs for exact endpoint and parameters.

**Field mapping:**

```
Supabase                  →  WorkOS API parameter
────────────────────────────────────────────────
email                     →  email
encrypted_password        →  password_hash
(bcrypt algorithm)        →  password_hash_type: 'bcrypt'
email_confirmed_at        →  email_verified (boolean: IS NOT NULL)
first_name/last_name      →  Parse from raw_user_meta_data if present
```

**CRITICAL:** Set `password_hash_type` to `'bcrypt'` — this is Supabase's algorithm. WorkOS will validate passwords against these hashes natively.

**Rate limiting:**

Check fetched docs for current rate limits. Batch imports with delays between requests.

**Pattern:**

```
BATCH_SIZE = 100
DELAY_MS = 1000  # Adjust based on fetched rate limit docs

FOR EACH batch OF BATCH_SIZE users:
  PARALLEL import users in batch
  WAIT DELAY_MS
```

**Verification command:**

```bash
# Check import progress (replace with your script output)
tail -f import_log.txt | grep "imported" | wc -l
```

## Step 6: Create Organization Memberships (if applicable)

**Skip if:** No organizations created in Step 4.

For each user with tenant mapping:

```
FOR EACH (user_id, tenant_id) IN tenant_mapping:
  CREATE Organization Membership:
    - user_id: WorkOS user ID from Step 5 import
    - organization_id: WorkOS org ID from Step 4
    - role_slug: map from Supabase role if using RBAC
```

Check fetched docs for Organization Membership API endpoint and role slug format.

**Verification:**

```bash
# Spot check: Get memberships for test organization
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id=$TEST_ORG_ID" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 7: Social Auth Provider Configuration

**If you DON'T use social auth:** Skip this step.

Supabase social auth users match by email address in WorkOS. Steps:

1. Configure OAuth provider in WorkOS Dashboard (check fetched docs for exact navigation path)
2. Add provider client credentials (see relevant integration guide: workos-authkit-google, workos-authkit-microsoft)
3. Users sign in with social provider → WorkOS auto-links by email

**TRAP:** Email verification behavior varies by provider. Gmail users auto-verify. Custom domain emails may require verification step.

**Action:** Test with a non-Gmail social auth user BEFORE full migration to confirm verification flow.

## Step 8: Update Application Auth Logic

Replace Supabase SDK calls with WorkOS AuthKit. Architectural changes:

```
Supabase pattern                 →  WorkOS pattern
─────────────────────────────────────────────────────
supabase.auth.getSession()       →  Use AuthKit middleware/withAuth
supabase.auth.signInWithPassword →  Redirect to WorkOS hosted auth
supabase.auth.signOut()          →  AuthKit signOut function
RLS policies with auth.uid()     →  Organization-based access control
```

**Do NOT attempt to replicate Supabase's client-side session management.** WorkOS uses server-side sessions.

See related skills for framework-specific integration:
- workos-authkit-nextjs (Next.js App Router)
- workos-authkit-react (React SPAs)
- workos-authkit-vanilla-js (vanilla JS)

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration success:

```bash
# 1. Export completeness
# (Adjust query for your export format)
echo "Exported rows: $(wc -l < exported_users.csv)"
echo "Supabase count: [CHECK DASHBOARD]"

# 2. Import success rate
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Should match exported row count

# 3. Organization memberships (if applicable)
curl -X GET "https://api.workos.com/user_management/organization_memberships" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
# Should match users with tenant mappings

# 4. Password auth test
# Attempt login with migrated user credentials via AuthKit UI
# Should succeed without password reset

# 5. Social auth test (if applicable)
# Sign in with Google/Microsoft account that exists in Supabase
# Should auto-link to imported WorkOS user by email
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email or ID collision.

**Fix:**
1. Check if user was partially imported in previous run
2. Use Update User API instead of Create User API for existing users
3. Verify export has no duplicate emails: `sort exported_users.csv | uniq -d`

### "Invalid password_hash format"

**Cause:** Exported hash is not bcrypt or contains invalid characters.

**Fix:**
1. Confirm `encrypted_password` column value starts with `$2a$` or `$2b$` (bcrypt signature)
2. Do NOT modify hash during export — copy exactly as stored
3. If hash is NULL, import user without password_hash and trigger password reset flow

### "Organization not found" during membership creation

**Cause:** Organization ID mismatch or org not created yet.

**Fix:**
1. Verify organization was created in Step 4: `curl https://api.workos.com/organizations -H "Authorization: Bearer $WORKOS_API_KEY"`
2. Check tenant_id mapping logic — ensure org IDs match exactly
3. Create missing organizations before retrying memberships

### Social auth user not auto-linking

**Cause:** Email mismatch or verification required.

**Fix:**
1. Verify email in social provider matches imported user email EXACTLY (case-sensitive)
2. Check WorkOS Dashboard > Authentication > Email Verification settings
3. If email verification enabled, user may need to verify email first
4. For Gmail: auto-verified. For custom domains: may require verification step.

### MFA users locked out

**Cause:** TOTP secrets not migrated (Supabase limitation).

**Fix:**
1. **This is expected behavior.** Supabase does not expose TOTP secrets.
2. Communicate to users: "Please re-enroll MFA after migration"
3. Provide MFA enrollment flow in your app (see WorkOS MFA guide)
4. For SMS MFA users: redirect to TOTP or Magic Auth (WorkOS does not support SMS MFA)

### Rate limit exceeded during import

**Cause:** Importing too many users too quickly.

**Fix:**
1. Check fetched docs for current Create User API rate limit
2. Increase delay between batches: `DELAY_MS = 2000` or higher
3. Reduce batch size: `BATCH_SIZE = 50`
4. Implement exponential backoff on 429 responses

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS AuthKit in Next.js applications
- workos-authkit-react — Integrate WorkOS AuthKit in React SPAs
- workos-authkit-vanilla-js — Integrate WorkOS AuthKit in vanilla JavaScript
