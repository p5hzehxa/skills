---
name: workos-migrate-better-auth
description: Migrate to WorkOS from Better Auth.
---

<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Database Access

Better Auth uses multiple tables. Confirm you have read access to:

- `user` table (core user data)
- `account` table (passwords + social auth)
- `organization` table (if using organization plugin)
- `member` table (if using organization plugin)

**Decision: Export Method**

```
How will you export data?
  |
  +-- Native DB tools --> Use pg_dump, mysqldump, etc.
  |
  +-- ORM (Prisma) --> Write export script using Prisma client
  |
  +-- Direct SQL --> Query tables, export to JSON/CSV
```

Choose ONE method before proceeding. Do not mix approaches.

### WorkOS Environment

Confirm in WorkOS Dashboard:

- Environment exists (Production or Staging)
- API key has `users:write` permission
- AuthKit is enabled for environment

Check `.env` or environment variables for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

## Step 3: Export Better Auth Data

### Export Users

Query user table:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

Save output to `users_export.json` or `users_export.csv`. Format choice must match your import script.

### Export Password Hashes

Query account table for credential-based accounts:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

Save to `passwords_export.json`.

**CRITICAL: Password Algorithm Detection**

Better Auth defaults to `scrypt`, but supports custom hashing. Check your Better Auth config:

```
Better Auth password algorithm?
  |
  +-- scrypt (default) --> Use password_hash_type='scrypt'
  |
  +-- bcrypt --> Use password_hash_type='bcrypt'
  |
  +-- argon2 --> Use password_hash_type='argon2'
  |
  +-- pbkdf2 --> Use password_hash_type='pbkdf2'
```

Write algorithm name to `password_algorithm.txt` for import step.

### Export Social Auth Accounts (If Used)

Query account table for social providers:

```sql
SELECT userId, providerId, providerAccountId
FROM account
WHERE providerId != 'credential';
```

Save to `social_accounts_export.json`.

Common Better Auth `providerId` values: `'google'`, `'github'`, `'microsoft'`, `'apple'`.

### Export Organizations (If Using Plugin)

If using Better Auth organization plugin, export organizations and members:

```sql
-- Organizations
SELECT id, name, slug, metadata, createdAt
FROM organization;

-- Members
SELECT userId, organizationId, role, createdAt
FROM member;
```

Save to `organizations_export.json` and `members_export.json`.

## Step 4: Import Users to WorkOS

### Rate Limit Strategy

WorkOS Create User API is rate-limited. Check fetched docs for current limits.

For large migrations (1000+ users), implement batching:

```
Batch size: 50-100 users
Delay between batches: 1-2 seconds
```

### Field Mapping

Map Better Auth `user` table columns to WorkOS Create User API:

| Better Auth     | WorkOS           | Notes                           |
| --------------- | ---------------- | ------------------------------- |
| `email`         | `email`          | Required                        |
| `emailVerified` | `email_verified` | Boolean                         |
| `name`          | `first_name`     | Parse full name for first name  |
| `name`          | `last_name`      | Parse full name for last name   |

**Name Parsing Logic**

Better Auth stores full name in single `name` field. Split for WorkOS:

```
Parse name:
  |
  +-- "John Doe" --> first_name="John", last_name="Doe"
  |
  +-- "Alice" --> first_name="Alice", last_name="" (empty string allowed)
  |
  +-- "María García López" --> first_name="María", last_name="García López"
```

Use space-split with first token as `first_name`, rest as `last_name`.

### Import Pseudocode

```
For each user in users_export:
  1. Parse name into first_name and last_name
  2. Create user via WorkOS SDK:
     - email: user.email
     - email_verified: user.emailVerified
     - first_name: parsed first name
     - last_name: parsed last name
  3. Store mapping: betterauth_id -> workos_user_id
  4. If batch complete, delay before next batch
  5. Log success/failure for each user
```

**Error Handling Pattern**

```
For each user creation:
  |
  +-- Success (201) --> Log workos_user_id, continue
  |
  +-- Email exists (409) --> Log conflict, continue (don't fail migration)
  |
  +-- Rate limit (429) --> Increase delay, retry with exponential backoff
  |
  +-- Invalid email (400) --> Log error, skip user, continue
  |
  +-- Auth error (401/403) --> STOP migration, fix API key
```

Never fail entire migration on single user error (except auth errors).

## Step 5: Import Password Hashes

**CRITICAL: PHC Format Requirement**

WorkOS requires password hashes in PHC string format. Better Auth may store raw scrypt hashes.

### Check Hash Format

Inspect first password hash from `passwords_export.json`:

```
Does hash start with "$scrypt$" or similar?
  |
  +-- YES (PHC format) --> Use hash directly
  |
  +-- NO (raw hash) --> Convert to PHC format (see Step 5a)
```

### Step 5a: PHC Format Conversion (If Needed)

If Better Auth stores raw scrypt hashes, convert to PHC format. Check fetched docs for exact PHC parameter requirements for scrypt.

**Common scrypt PHC format:**

```
$scrypt$ln=<log_n>,r=<r>,p=<p>$<salt_base64>$<hash_base64>
```

Example: `$scrypt$ln=15,r=8,p=1$c2FsdA$aGFzaA`

If you don't have Better Auth's scrypt parameters, check Better Auth config or use defaults (ln=15, r=8, p=1).

### Import Passwords

**Decision: When to Import**

```
Import passwords:
  |
  +-- During user creation --> Include password_hash in Create User call
  |
  +-- After user creation --> Use Update User API with workos_user_id
```

Choose ONE. During creation is more efficient.

### Import Pseudocode

```
For each password in passwords_export:
  1. Look up workos_user_id from betterauth_user_id mapping
  2. Update user via WorkOS SDK:
     - user_id: workos_user_id
     - password_hash: PHC formatted hash
     - password_hash_type: 'scrypt' (or detected algorithm)
  3. Log success/failure
```

**Algorithm-Specific Parameters**

Check fetched docs for exact parameters required for each algorithm:

- `scrypt`: Requires `ln`, `r`, `p` parameters in PHC format
- `bcrypt`: Requires cost factor
- `argon2`: Requires variant, memory, iterations, parallelism
- `pbkdf2`: Requires iterations, hash function

## Step 6: Configure Social Auth Providers

If you exported social accounts in Step 3, configure providers in WorkOS Dashboard.

### Provider Setup Checklist

For each unique `providerId` in `social_accounts_export.json`:

```bash
# Check which providers you need
jq -r '.[] | .providerId' social_accounts_export.json | sort -u
```

For each provider (google, github, microsoft, etc.):

1. Navigate to WorkOS Dashboard → Integrations
2. Find provider in list (check integrations page in fetched docs for supported providers)
3. Configure OAuth client credentials (client ID, client secret)
4. Set redirect URI to your app's callback URL
5. Enable provider for your environment

**Matching Behavior**

After provider setup, users signing in via social auth will auto-match by **email address**. No manual linking required.

**Email Verification Note**

Some providers require email verification after first WorkOS login. Check fetched docs for provider-specific behavior (gmail.com domains skip verification, others may not).

## Step 7: Migrate Organizations (If Applicable)

Skip this step if you didn't export organizations in Step 3.

### Create Organizations

For each organization in `organizations_export.json`:

```
Create organization:
  1. Map Better Auth org fields to WorkOS:
     - name: org.name
     - domains: (extract from org.metadata if present)
  2. Create org via WorkOS SDK
  3. Store mapping: betterauth_org_id -> workos_org_id
```

Check fetched docs for Create Organization API field requirements.

### Add Organization Members

For each member in `members_export.json`:

```
Add member:
  1. Look up workos_user_id from betterauth_user_id mapping
  2. Look up workos_org_id from betterauth_org_id mapping
  3. Add user to org via WorkOS SDK:
     - user_id: workos_user_id
     - organization_id: workos_org_id
     - role: (map Better Auth role to WorkOS role - see below)
```

**Role Mapping Decision**

```
Better Auth role --> WorkOS role
  |
  +-- Better Auth uses custom roles --> Map to WorkOS roles or use generic "member"
  |
  +-- Better Auth uses standard roles (admin, member) --> Use WorkOS equivalents
```

Check fetched docs for WorkOS Organization role names and capabilities.

## Step 8: Verification

Run these commands to confirm migration success:

```bash
# 1. Check all user IDs were mapped
jq -r '.[] | .id' users_export.json | wc -l
# Should match number of successful user creations in logs

# 2. Check password import success rate
grep "password import success" migration.log | wc -l
# Should match number of credential accounts exported

# 3. Spot check: Fetch random WorkOS user
# (Replace USER_ID with actual workos_user_id from mapping)
curl https://api.workos.com/users/USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# 4. If organizations: Check org creation count
grep "organization created" migration.log | wc -l
# Should match organizations_export.json count
```

### Test User Login

Create test script to verify migrated users can authenticate:

1. Pick test user from `users_export.json`
2. Attempt password login via AuthKit
3. If user had social auth, attempt OAuth login
4. Verify session works correctly

**All verification steps must pass before marking migration complete.**

## Error Recovery

### "Email already exists" (409)

**Not an error** — WorkOS found duplicate email. Log and continue. User may have been partially migrated in previous run.

**Action:** Skip user creation, but still import password hash using existing user ID.

### "Invalid password hash format" (400)

**Root cause:** Hash not in PHC format or missing required parameters.

**Fix:**

1. Check fetched docs for exact PHC format for your algorithm
2. Verify conversion logic in Step 5a
3. Test with single hash before batch import
4. Common mistake: Missing salt or hash encoding (must be base64)

### "Rate limit exceeded" (429)

**Root cause:** Batch size too large or delay too short.

**Fix:**

1. Reduce batch size to 25-50 users
2. Increase delay to 2-3 seconds
3. Implement exponential backoff on 429 response
4. Resume from last successful user ID

### "Authorization failed" (401/403)

**Root cause:** API key invalid or missing permissions.

**Fix:**

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key in WorkOS Dashboard → API Keys
3. Confirm key has `users:write` scope
4. If using environment-specific keys, verify correct environment

**Never continue migration with auth errors** — fix immediately.

### "User not found" during password import

**Root cause:** User ID mapping failed or user creation didn't succeed.

**Fix:**

1. Check user creation logs for failures
2. Verify user ID mapping file is complete
3. Re-run user creation for failed users before password import
4. Use Update User API instead of Create User for retry

### Social auth users can't sign in

**Root cause:** Provider not configured or email mismatch.

**Fix:**

1. Verify provider is enabled in WorkOS Dashboard
2. Check OAuth client credentials are correct
3. Confirm redirect URI matches app callback URL
4. Verify user's email from provider matches WorkOS user email (case-sensitive)

### Organization members not linking correctly

**Root cause:** User or org ID mapping incomplete.

**Fix:**

1. Check both user and org creation succeeded
2. Verify mapping files contain all IDs
3. Check for Better Auth orphaned members (user/org deleted but member record remains)
4. Re-create missing users/orgs before linking

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit with Next.js after migration
- workos-authkit-react - Integrate AuthKit with React after migration
