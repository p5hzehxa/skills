<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Database Access Pattern (Decision Tree)

Better Auth stores data across multiple tables. Determine export method:

```
Database access?
  |
  +-- Direct SQL access --> Use SQL queries (Steps 3-4)
  |
  +-- ORM (Prisma, etc.) --> Use ORM query methods (adapt SQL to ORM syntax)
  |
  +-- Database export tool --> Export to CSV/JSON, parse in migration script
```

**Tables to export:**

- `user` - Core user data (id, name, email, emailVerified, image, timestamps)
- `account` - Provider credentials, including password hashes (providerId='credential' for passwords)
- `organization` - If using organization plugin
- `member` - User-to-org mappings with roles

## Step 3: Export User Data

Query the `user` table:

```sql
SELECT * FROM user;
```

Export format: JSON, CSV, or any parseable format for your migration script.

**Field mapping for WorkOS Create User API:**

```
Better Auth field --> WorkOS parameter
email             --> email
emailVerified     --> email_verified
name              --> first_name (split name string)
name              --> last_name (split name string)
```

**TRAP:** Better Auth stores full name in single `name` field. You must split it into first/last for WorkOS. Naive split on first space is acceptable for migration.

## Step 4: Export Password Hashes

Query the `account` table for credential-based accounts:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**Critical:** Better Auth defaults to `scrypt` hashing. If using custom hashing in Better Auth config, note the algorithm — WorkOS supports scrypt, bcrypt, argon2, pbkdf2.

### PHC Format Requirement

WorkOS requires password hashes in PHC string format. Better Auth stores scrypt hashes — verify format:

```
Expected: $scrypt$...$...$...
If raw hash: Convert to PHC format before import
```

Check fetched docs for PHC format parameters (N, r, p values) for each supported algorithm.

## Step 5: Import Users with Rate Limiting

Use WorkOS Create User API for each exported user. API is rate-limited — implement batching.

**Pseudocode pattern:**

```
for batch in users.chunks(BATCH_SIZE):
  for user in batch:
    create_user(user_data)
  sleep(RATE_LIMIT_DELAY)
```

Check fetched docs for current rate limits and recommended batch sizes.

**Password hash import:**

Set `password_hash_type` to match Better Auth algorithm (default: `'scrypt'`). Include `password_hash` parameter with PHC-formatted hash from `account` table.

**Alternate timing:** You can import password hashes AFTER user creation using Update User API if preferred (same parameters).

## Step 6: Social Auth Provider Setup

Better Auth stores social auth accounts in `account` table with `providerId` values like `'google'`, `'github'`, `'microsoft'`.

**Pattern for provider migration:**

1. Query accounts: `SELECT userId, providerId FROM account WHERE providerId != 'credential'`
2. For each unique providerId, configure that provider in WorkOS Dashboard
3. Check workos.com/integrations for provider-specific setup guides
4. Users sign in with provider → WorkOS auto-links to user by email match

**Email verification behavior:**

- Known providers (Google with @gmail.com) → skip verification
- Unknown providers or custom domains → may require email verification depending on environment settings
- Check WorkOS Dashboard auth settings for email verification config

## Step 7: Organizations Migration (If Using Plugin)

If Better Auth organization plugin is active, export `organization` and `member` tables.

**Organization creation:**

Check fetched docs for WorkOS Organizations API — create each org, then add members with role mappings.

**Role mapping:** Better Auth role slugs → WorkOS role slugs. Check fetched docs for WorkOS role schema if custom roles are needed.

## Verification Checklist (ALL MUST PASS)

Run these commands and checks:

```bash
# 1. Confirm data export files exist
ls user_export.json password_export.json 2>/dev/null || echo "FAIL: Missing exports"

# 2. Verify PHC format for sample hash
grep '^\$scrypt\$' password_export.json || echo "WARN: Check PHC format"

# 3. Test Create User API with one user (dry run)
# Use SDK method for create user with test data

# 4. Check provider configs in WorkOS Dashboard
# Manual check: Dashboard > Configuration > Authentication > Connections
```

**Post-migration verification:**

- Sample user can sign in with migrated password
- Sample user can sign in with social provider (if applicable)
- Organization memberships preserved (if using orgs)

## Error Recovery

### "Invalid password hash format"

**Cause:** Hash not in PHC string format.

**Fix:**

1. Check Better Auth database — hash should start with `$scrypt$` (or other algorithm prefix)
2. If raw hash: Convert to PHC format using algorithm params from Better Auth config
3. Verify N, r, p parameters match Better Auth scrypt settings (defaults: N=16384, r=8, p=1)

### "Email already exists"

**Cause:** User already created in WorkOS, or duplicate in Better Auth export.

**Fix:**

1. Check if user exists in WorkOS first (use List Users API)
2. If exists, use Update User API instead of Create User
3. Deduplicate Better Auth export by email before import

### "Rate limit exceeded"

**Cause:** Import script not respecting rate limits.

**Fix:**

1. Check fetched docs for current rate limits
2. Add delays between batches: `sleep(1)` between requests minimum
3. Reduce batch size, increase delay

### Social auth user can't sign in after migration

**Cause:** Provider not configured in WorkOS Dashboard, or email mismatch.

**Fix:**

1. Verify provider credentials configured in Dashboard
2. Check user's email in Better Auth matches provider's email claim
3. Check environment email verification settings — may need manual verification for some providers

### Organization members missing roles

**Cause:** Role slug mismatch between Better Auth and WorkOS.

**Fix:**

1. Export Better Auth member table: `SELECT userId, organizationId, role FROM member`
2. Map Better Auth role names to WorkOS role slugs (check fetched docs for WorkOS role schema)
3. Use WorkOS Organizations API to assign roles after creating memberships

### Name field splitting produces bad results

**Cause:** Better Auth `name` field contains non-standard formats (single name, multiple spaces, prefixes).

**Fix:**

1. Implement smarter split logic: check for common prefixes (Dr., Mr., etc.)
2. For single-word names: use as first_name, leave last_name empty
3. For complex names: manual review or leave as-is (WorkOS allows empty last_name)
