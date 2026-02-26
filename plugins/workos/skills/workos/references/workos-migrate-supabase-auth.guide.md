<!-- refined:sha256:d6de555bda48 -->

# WorkOS Migration: Supabase Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/supabase`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Access Requirements

- Direct database access to Supabase (SQL Editor or database client)
- WorkOS API key with user management permissions (`sk_*`)
- WorkOS organization ID for user import

### Data Volume Check

Run this query to estimate migration scope:

```sql
SELECT COUNT(*) as total_users,
       COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as verified_users
FROM auth.users;
```

**Decision tree for migration strategy:**

```
Total users?
  |
  +-- < 1,000 users --> Single-batch import (proceed to Step 3)
  |
  +-- 1,000 - 10,000 --> Batched import with 100 users/batch, 1 second delay
  |
  +-- > 10,000 --> Contact WorkOS support for bulk import assistance
```

Check fetched docs for current rate limits.

## Step 3: Export User Data

### SQL Export Query

Run in Supabase SQL Editor:

```sql
SELECT
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  phone,
  phone_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data
FROM auth.users
WHERE deleted_at IS NULL
ORDER BY created_at ASC;
```

**Critical:** Export to CSV or JSON. Do NOT use screenshots or manual copying for production migrations.

### Password Hash Verification

Supabase uses bcrypt. Confirm hashes start with `$2a$`, `$2b$`, or `$2y$`:

```bash
# Verify hash format in exported CSV
head -5 users.csv | cut -d',' -f3 | grep '^\$2[aby]\$' && echo "✓ valid bcrypt" || echo "✗ invalid format"
```

If verification fails, re-export — corrupted hashes cannot be recovered.

## Step 4: Import Users to WorkOS

### Field Mapping (Decision Tree)

Map Supabase columns to WorkOS Create User API parameters:

```
Supabase column              WorkOS parameter
├─ email                  →  email
├─ encrypted_password     →  password_hash (+ password_hash_type: 'bcrypt')
├─ email_confirmed_at     →  email_verified: true if non-null, false if null
├─ phone                  →  Skip (WorkOS AuthKit uses email-based auth)
├─ id (UUID)              →  Store in your app's user mapping table
└─ raw_user_meta_data     →  firstName/lastName if present, else skip
```

**Trap:** Do NOT use Supabase UUIDs as WorkOS user IDs. WorkOS generates its own user IDs (`user_*`). Store the mapping in your database:

```
supabase_user_id (UUID) → workos_user_id (user_*)
```

### Import Code Pattern

Use language-agnostic SDK syntax:

```
// Per-user import loop with error handling
for each user in export:
  try:
    result = workos.userManagement.createUser({
      email: user.email,
      password_hash: user.encrypted_password,
      password_hash_type: 'bcrypt',
      email_verified: user.email_confirmed_at != null,
      first_name: user.raw_user_meta_data?.first_name,
      last_name: user.raw_user_meta_data?.last_name
    })

    // Store mapping for session migration
    save_mapping(user.id, result.id)

  catch RateLimitError:
    wait(1 second)
    retry

  catch DuplicateEmailError:
    log("User already exists: " + user.email)
    continue
```

**Critical for large migrations:** Implement exponential backoff for rate limit errors. Check fetched docs for current rate limit values.

### Batch Processing

For 1,000+ users, batch with delays:

```
batch_size = 100
delay_between_batches = 1 second

for each batch in chunks(users, batch_size):
  import_batch(batch)
  wait(delay_between_batches)
```

## Step 5: Session Migration Strategy

**Trap:** You CANNOT migrate active sessions from Supabase to WorkOS. Sessions are provider-specific.

**Decision tree for session handling:**

```
User logs in after migration?
  |
  +-- Has valid Supabase session --> Force re-authentication with WorkOS
  |
  +-- No active session --> Normal WorkOS login flow
```

Implementation pattern:

```
// In your auth middleware
if supabase_session_exists() and not workos_session_exists():
  clear_supabase_session()
  redirect_to_workos_login()
```

## Verification Checklist (ALL MUST PASS)

Run these checks after import completes:

```bash
# 1. Verify import completed
echo "SELECT COUNT(*) FROM your_user_mapping_table;" | psql $DATABASE_URL

# 2. Test password auth for migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=test@example.com" \
  -d "password=test_password" \
  | grep -q "user_id" && echo "✓ password auth works" || echo "✗ auth failed"

# 3. Verify email_verified flag preserved
# (Check WorkOS Dashboard → Users → pick a verified user → should show verified badge)
```

**Do not mark migration complete until test login succeeds.**

## Error Recovery

### "Invalid password hash format"

**Root cause:** Password hash corrupted during export or contains non-bcrypt format.

Fix:

1. Re-export from Supabase with explicit CAST: `CAST(encrypted_password AS TEXT)`
2. Verify hash starts with `$2a$`, `$2b$`, or `$2y$`
3. If still failing, that user must reset password — WorkOS cannot import non-bcrypt hashes

### "Email already exists" during import

**Root cause:** Duplicate email in Supabase export OR user already imported in previous run.

Fix:

1. Check if user already exists in WorkOS: query Users API by email
2. If exists with correct password hash, skip import for that user
3. If exists WITHOUT password hash, use Update User API to add password hash
4. If truly duplicate in Supabase, decide which record to keep before import

### Rate limit errors (429) not recovering

**Root cause:** Batch delay too short for your import volume.

Fix:

1. Increase delay between batches to 2-5 seconds
2. Reduce batch size to 50 users
3. Implement exponential backoff: first retry after 1s, then 2s, then 4s, up to 60s max
4. For >10,000 users, contact WorkOS support for bulk import

### Users can't log in after migration

**Root cause:** Password hash not imported OR email_verified flag incorrect.

Fix:

1. Query WorkOS Users API for affected user — check `password_hash` field exists
2. If missing, use Update User API to add password hash from Supabase export
3. Check `email_verified` matches Supabase `email_confirmed_at` status
4. Test login via API (not just Dashboard) to confirm password verification works

## Related Skills

- workos-authkit-nextjs — for implementing WorkOS authentication UI post-migration
- workos-authkit-react — for React-based migration landing pages
