<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Database Export Validation

### Schema Detection

Better Auth stores data across multiple tables. Verify these exist in your database:

```bash
# Check for required tables (adjust for your DB type)
psql -d your_db -c "\dt" | grep -E "(user|account|organization|member)"
```

**CRITICAL:** The `account` table stores password hashes. Missing this table means passwords cannot be migrated.

### Organization Plugin Detection

```bash
# Check if organization/member tables exist
psql -d your_db -c "\dt" | grep -E "(organization|member)"
```

```
Tables found?
  |
  +-- Both exist --> Follow Organization Migration path (Step 5)
  |
  +-- Neither exists --> Skip Step 5, users only
  |
  +-- Only one exists --> ERROR: Schema corrupted, investigate before migrating
```

## Step 3: Export User Data

### Core User Export

Query the `user` table. Export to JSON/CSV for processing:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

**Trap:** Better Auth `name` is a single field. WorkOS requires `first_name` and `last_name`. Decision tree:

```
name field contains space?
  |
  +-- Yes --> Split on first space: "John Doe" -> first_name="John", last_name="Doe"
  |
  +-- No  --> Use full value for first_name, leave last_name empty or use placeholder
  |
  +-- NULL --> Set both to empty string or omit (check docs for required fields)
```

### Password Hash Export

Export passwords from `account` table:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**CRITICAL:** Better Auth default is `scrypt`. If you configured a custom hash algorithm, note it for Step 4.

**Verification command:**

```bash
# Check password format - should be PHC string or raw scrypt
echo "Sample password hash: $(psql -d your_db -tAc "SELECT password FROM account WHERE providerId = 'credential' LIMIT 1")"
```

### Social Auth Account Export

Export linked social accounts:

```sql
SELECT userId, providerId, accountId, email
FROM account
WHERE providerId != 'credential';
```

**Note:** `providerId` values map to WorkOS connection types (e.g., `'google'` → Google OAuth, `'github'` → GitHub OAuth). Verify WorkOS supports each provider in your export before migrating.

## Step 4: Import Users with Passwords

### Rate Limit Strategy

WorkOS Create User API is rate-limited. Check fetched docs for current limits.

**Decision tree for batching:**

```
Total users?
  |
  +-- < 100   --> No batching needed, import sequentially
  |
  +-- 100-1k  --> Batch size 10, sleep 1s between batches
  |
  +-- 1k-10k  --> Batch size 5, sleep 2s between batches
  |
  +-- 10k+    --> Contact WorkOS for bulk import options
```

### Field Mapping

Better Auth → WorkOS User Create API:

- `email` → `email`
- `emailVerified` → `email_verified`
- `name` → split into `first_name` + `last_name` (see Step 3 trap)

**Omit these Better Auth fields:** `image`, `id` (WorkOS generates new IDs), timestamps (WorkOS sets these)

### Password Hash Format

Better Auth default is `scrypt`. Password hash must be PHC string format:

```
$scrypt$n=16384,r=8,p=1$<salt>$<hash>
```

**Trap:** If Better Auth is storing raw scrypt hashes (not PHC format), you must convert them. The conversion requires:
- Extract salt and hash bytes
- Encode in PHC format with parameters: `n=16384,r=8,p=1` (Better Auth defaults)

Check fetched docs for PHC format requirements and examples.

**For custom hash algorithms:** Better Auth supports bcrypt, argon2, pbkdf2. WorkOS supports these too — check fetched docs for each algorithm's PHC format.

### Import API Call

Use WorkOS SDK method for creating user:

```
password_hash_type: 'scrypt'
password_hash: <PHC format hash from account table>
email: <from user table>
email_verified: <from user table>
first_name: <split from name>
last_name: <split from name>
```

**Verification command after import:**

```bash
# Verify user count matches export
workos_user_count=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length')
better_auth_count=$(psql -d your_db -tAc "SELECT COUNT(*) FROM user")
echo "Better Auth: $better_auth_count, WorkOS: $workos_user_count"
```

## Step 5: Social Auth Migration

**Prerequisites:** Configure OAuth providers in WorkOS Dashboard. Check fetched docs for provider-specific setup.

### Provider Mapping

Better Auth `providerId` → WorkOS connection type:
- `'google'` → Google OAuth
- `'github'` → GitHub OAuth
- `'microsoft'` → Microsoft OAuth

**CRITICAL:** After provider setup, users sign in with social auth and WorkOS auto-links by email. No additional API calls needed for social auth accounts.

### Email Verification Trap

**Decision tree for email verification:**

```
Provider + email domain?
  |
  +-- Google + gmail.com    --> Auto-verified, no extra step
  +-- Microsoft + outlook.* --> Auto-verified, no extra step
  +-- Other combinations    --> User may need to verify email (check docs)
```

**Trap:** If Better Auth marked `emailVerified=true` but WorkOS doesn't trust the provider, user will be prompted to verify. This is expected behavior — do NOT try to force-verify via API.

## Step 6: Organization Migration (Optional)

**Only if Step 2 detected organization/member tables.**

### Export Organization Data

```sql
-- Export organizations
SELECT id, name, slug, createdAt
FROM organization;

-- Export memberships
SELECT userId, organizationId, role
FROM member;
```

### Import Organizations

Use WorkOS Organization Create API. Check fetched docs for exact parameters.

**Field mapping:**
- `name` → organization name
- `slug` → NOT directly supported — WorkOS generates slugs. You can store Better Auth slug as metadata.

### Import Members

For each membership record:
1. Lookup WorkOS user ID by Better Auth `userId` (map from Step 4 import)
2. Lookup WorkOS organization ID by Better Auth `organizationId` (map from org import)
3. Use WorkOS API to add user to organization with role

**Role mapping trap:** Better Auth roles are custom strings. WorkOS has predefined roles (`admin`, `member`). Decision tree:

```
Better Auth role?
  |
  +-- "owner" or "admin"  --> WorkOS: admin
  +-- "member" or "user"  --> WorkOS: member
  +-- Custom roles        --> Default to "member", store original in user metadata
```

Check fetched docs for WorkOS Organization Member API for exact role values.

## Verification Checklist (ALL MUST PASS)

Run these commands after migration:

```bash
# 1. User count matches
better_auth_users=$(psql -d your_db -tAc "SELECT COUNT(*) FROM user")
workos_users=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '.data | length')
[ "$better_auth_users" -eq "$workos_users" ] && echo "PASS: User count matches" || echo "FAIL: User count mismatch"

# 2. Password hashes imported
workos_password_users=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users" | jq '[.data[] | select(.password_hash != null)] | length')
better_auth_passwords=$(psql -d your_db -tAc "SELECT COUNT(*) FROM account WHERE providerId = 'credential'")
[ "$better_auth_passwords" -eq "$workos_password_users" ] && echo "PASS: Passwords imported" || echo "FAIL: Password count mismatch"

# 3. OAuth providers configured (if social auth users exist)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/connections" | jq '.data[].name'

# 4. Organizations imported (if applicable)
if psql -d your_db -c "\dt" | grep -q "organization"; then
  better_auth_orgs=$(psql -d your_db -tAc "SELECT COUNT(*) FROM organization")
  workos_orgs=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
    "https://api.workos.com/organizations" | jq '.data | length')
  [ "$better_auth_orgs" -eq "$workos_orgs" ] && echo "PASS: Organization count matches" || echo "FAIL: Organization count mismatch"
fi
```

## Error Recovery

### "Invalid password_hash format"

**Root cause:** Password hash not in PHC string format.

Fix:
1. Check hash starts with `$scrypt$` (or `$bcrypt$`, `$argon2$`, etc.)
2. Verify parameters match Better Auth config (default: `n=16384,r=8,p=1` for scrypt)
3. If raw hash, convert to PHC format before import (see Step 4 trap)

### "User email already exists"

**Root cause:** Re-running import script without deduplication.

Fix:
1. Check WorkOS for existing user: `GET /user_management/users?email={email}`
2. If exists, use Update User API instead of Create
3. Or: Delete test users before re-running migration

### "Rate limit exceeded"

**Root cause:** Importing too fast (see Step 4 rate limit strategy).

Fix:
1. Add sleep between batches: `sleep 2` (adjust based on rate limit)
2. For large migrations (10k+ users), contact WorkOS for bulk import assistance
3. Check fetched docs for current rate limits

### Social auth users can't sign in after migration

**Root cause:** OAuth provider not configured in WorkOS Dashboard.

Fix:
1. Check WorkOS Dashboard → Connections
2. Verify provider (Google, GitHub, etc.) has client ID/secret configured
3. Verify redirect URLs match your application
4. Check fetched docs for provider-specific setup

### Organization members not linked

**Root cause:** User ID mapping from Better Auth to WorkOS failed.

Fix:
1. During user import (Step 4), store mapping: `{ betterAuthUserId: workosUserId }`
2. Use mapping in Step 6 to lookup WorkOS user IDs
3. If mapping lost, re-query WorkOS users by email to rebuild mapping

### "password_hash_type 'scrypt' not supported"

**Root cause:** Typo or outdated SDK version.

Fix:
1. Verify `password_hash_type` is exactly `'scrypt'` (lowercase, no extra quotes)
2. Update WorkOS SDK to latest version
3. Check fetched docs for supported hash types

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS auth in Next.js after migration
- workos-authkit-react — Integrate WorkOS auth in React apps after migration
