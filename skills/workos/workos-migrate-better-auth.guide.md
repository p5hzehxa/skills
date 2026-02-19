<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

This is the source of truth. If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Migration Assessment

### Database Schema Detection

Better Auth uses multiple tables. Confirm presence of:

- `user` table - core user data
- `account` table - password hashes and provider links
- `organization` table (optional) - if using organization plugin
- `member` table (optional) - org membership mappings

**Verification command:**

```bash
# For PostgreSQL
psql -d your_db -c "\dt" | grep -E "(user|account|organization|member)"

# For MySQL
mysql -e "SHOW TABLES LIKE 'user%'; SHOW TABLES LIKE 'account'; SHOW TABLES LIKE 'organization'; SHOW TABLES LIKE 'member';" your_db
```

### Password Hashing Algorithm Detection

Better Auth defaults to **scrypt**, but supports custom algorithms. Determine which is in use:

```
Check Better Auth config for:
  |
  +-- No custom hashing config --> scrypt (default)
  |
  +-- Custom hash function --> Note algorithm name for Step 4
```

Common custom algorithms: bcrypt, argon2, pbkdf2. All are WorkOS-supported.

## Step 3: Export Data from Better Auth

### Export Users

Query the `user` table directly:

```sql
SELECT 
  id,
  email,
  emailVerified,
  name,
  createdAt,
  updatedAt
FROM user;
```

Export format: JSON or CSV that your script can parse.

### Export Password Hashes

Query `account` table for credential providers only:

```sql
SELECT 
  userId,
  password,
  providerId
FROM account
WHERE providerId = 'credential';
```

**Critical:** The `password` field contains the hash. Note the storage format (PHC string vs raw hash).

### Export Social Auth Accounts (if applicable)

```sql
SELECT 
  userId,
  providerId,
  accountId
FROM account
WHERE providerId != 'credential';
```

Common `providerId` values: `google`, `github`, `microsoft`, `apple`.

### Export Organizations (if using organization plugin)

```sql
-- Organizations
SELECT * FROM organization;

-- Memberships
SELECT 
  userId,
  organizationId,
  role
FROM member;
```

## Step 4: Prepare Import Script

### Field Mapping (Decision Tree)

Better Auth `name` field is single string. WorkOS expects separate first/last names:

```
Better Auth name field?
  |
  +-- Contains space --> Split on first space: first_name / last_name
  |
  +-- No space --> first_name = full value, last_name = ""
  |
  +-- NULL/empty --> first_name = "", last_name = ""
```

Complete mapping:

| Better Auth field | WorkOS API parameter |
|------------------|---------------------|
| `email` | `email` |
| `emailVerified` | `email_verified` |
| `name` (split) | `first_name` |
| `name` (split) | `last_name` |

### Password Hash Format Check

WorkOS requires PHC string format for scrypt. Check your export:

```
Password hash format?
  |
  +-- Starts with "$scrypt$" --> PHC format, use directly
  |
  +-- Raw hex/base64 string --> Must convert to PHC format
```

**PHC format example:** `$scrypt$ln=16,r=8,p=1$saltbase64$hashbase64`

If raw format, defer to fetched docs for PHC conversion parameters.

### Rate Limiting Strategy

WorkOS Create User API has rate limits. Check fetched docs for current limits.

**Batching pattern:**

```
For large migrations (1000+ users):
  |
  +-- Batch size: 50-100 users per batch
  |
  +-- Delay between batches: 1-2 seconds
  |
  +-- Implement retry logic with exponential backoff
```

## Step 5: Import Users to WorkOS

### Create Users with Passwords

Use Create User API for each user. Pseudocode pattern:

```
For each user in export:
  |
  +-- Split name field --> first_name, last_name
  |
  +-- Call Create User API with:
      - email
      - email_verified
      - first_name
      - last_name
      - password_hash (from account table)
      - password_hash_type: "scrypt" (or detected algorithm)
  |
  +-- Store WorkOS user_id <-> Better Auth id mapping
  |
  +-- Handle rate limit errors with retry
```

**Critical:** Preserve the ID mapping for organization membership migration.

### Password Hash Type Parameter

Based on Step 2 detection:

```
Algorithm detected?
  |
  +-- scrypt --> password_hash_type: "scrypt"
  |
  +-- bcrypt --> password_hash_type: "bcrypt"
  |
  +-- argon2 --> password_hash_type: "argon2"
  |
  +-- pbkdf2 --> password_hash_type: "pbkdf2"
```

Check fetched docs for exact parameter format requirements per algorithm.

### Users Without Passwords (Social Auth Only)

For users with no credential account:

```
User has no password hash?
  |
  +-- Create user WITHOUT password_hash parameters
  |
  +-- User must authenticate via social provider on first login
```

## Step 6: Configure Social Auth Providers

### Provider Setup (if social auth accounts exist)

For each unique `providerId` in exported accounts:

1. Navigate to WorkOS Dashboard → Authentication → Social Auth
2. Enable the provider (Google, Microsoft, GitHub, etc.)
3. Configure OAuth client credentials

**Verification per provider:**

```bash
# Check provider is enabled
curl -X GET https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" | \
  jq '.data[] | select(.type=="GoogleOAuth")'
```

### Email Matching Behavior

WorkOS links social auth by email address automatically. From fetched docs:

- Email match between WorkOS user and provider email → auto-link
- Known email-verified providers (gmail.com via Google) → skip verification
- Unknown providers → may require email verification step

**Critical:** Users MUST use the same email address with the provider as in your Better Auth export.

## Step 7: Migrate Organizations (if applicable)

### Create Organizations

For each exported organization:

```
Use Create Organization API with:
  - name (from Better Auth organization table)
  - domains (if applicable)
```

### Import Organization Memberships

For each Better Auth member record:

```
Use Add Organization Member API with:
  - organization_id (from WorkOS)
  - user_id (from ID mapping in Step 5)
  - role (convert Better Auth role to WorkOS role slug)
```

**Role mapping pattern:** Check fetched docs for WorkOS role slug conventions. Better Auth roles may need transformation.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify user count matches
echo "Better Auth users: $(sqlite3 better_auth.db 'SELECT COUNT(*) FROM user')"
echo "WorkOS users: $(curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')"

# 2. Test password authentication for credential users
# Login via WorkOS AuthKit with migrated user credentials

# 3. Test social auth for provider users  
# Login via WorkOS with Google/GitHub/etc. using same email

# 4. Verify organizations imported (if applicable)
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 5. Check email_verified status preserved
curl -X GET https://api.workos.com/user_management/users/USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.email_verified'
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** Hash not in PHC string format or missing required parameters.

**Fix:**
1. Check if hash starts with `$scrypt$` (or other algorithm prefix)
2. If raw hash, convert to PHC format using algorithm-specific parameters
3. Defer to fetched docs for exact PHC parameter requirements for your algorithm

### "Rate limit exceeded" (429 status)

**Root cause:** Too many API calls without delay.

**Fix:**
1. Implement exponential backoff: wait 2^n seconds between retries
2. Reduce batch size to 50 users per batch
3. Add 1-2 second delay between batches

### Social auth users cannot sign in

**Root cause:** Email mismatch between Better Auth export and provider email, OR provider not configured in WorkOS.

**Fix:**
1. Verify provider is enabled in WorkOS Dashboard
2. Check OAuth client credentials are correct
3. Confirm user's provider email matches Better Auth email exactly
4. Check fetched docs for email verification requirements per provider

### Organizations not created

**Root cause:** Missing organization name or API parameters.

**Fix:**
1. Verify organization table export includes required fields
2. Check Create Organization API response for specific error
3. Ensure organization names are unique

### Users missing after import

**Root cause:** API errors not caught during batch processing.

**Fix:**
1. Log all API responses during import
2. Retry failed user creations separately
3. Compare Better Auth user IDs to WorkOS user ID mapping

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
