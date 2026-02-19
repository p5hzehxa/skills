<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Database Access

Verify you can query your Better Auth database. Better Auth uses these tables:

- `user` - core user data
- `account` - passwords and OAuth provider links
- `organization` - if using organization plugin
- `member` - organization membership mapping

**Verify:** Run a test query like `SELECT COUNT(*) FROM user;` before proceeding.

### SDK Installation

Confirm WorkOS SDK is installed:

```bash
# Check package.json or equivalent dependency file
grep -i workos package.json requirements.txt Gemfile pom.xml build.gradle || echo "SDK not found"
```

## Step 3: Export Better Auth Data

### User Export

Query the `user` table:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

Export format: JSON or CSV. Store the export file path for Step 5.

### Password Hash Export

Query the `account` table for credential-based accounts:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**Critical:** Note the hashing algorithm Better Auth is using. Check your Better Auth config — the default is `scrypt`, but it may be custom. WorkOS supports scrypt, bcrypt, argon2, and pbkdf2.

**Verify:** Password hashes should be present in the export. If passwords are NULL, users likely use social auth only.

### Organization Export (Optional)

If using Better Auth's organization plugin:

```sql
-- Organizations
SELECT id, name, slug, metadata, createdAt
FROM organization;

-- Memberships
SELECT id, organizationId, userId, role, createdAt
FROM member;
```

## Step 4: Password Hash Format Conversion

Better Auth uses scrypt by default. WorkOS requires PHC string format:

```
$scrypt$ln=<cost>,r=<block_size>,p=<parallelization>$<salt>$<hash>
```

**Decision tree:**

```
Password hash format?
  |
  +-- Already PHC format --> Proceed to Step 5
  |
  +-- Raw scrypt hash --> Convert to PHC format (see fetched docs for parameters)
  |
  +-- Custom algorithm (bcrypt/argon2/pbkdf2) --> Check fetched docs for format requirements
```

**Trap:** If Better Auth is storing raw hashes without PHC encoding, the import will fail silently. Convert BEFORE importing.

## Step 5: Import Users to WorkOS

### Field Mapping (Decision Tree)

Better Auth `name` field maps to WorkOS `first_name` and `last_name`:

```
name field content?
  |
  +-- Single word (e.g., "Alice") --> first_name = "Alice", last_name = ""
  |
  +-- Two words (e.g., "Alice Smith") --> Split on first space
  |
  +-- Multiple words --> first_name = first word, last_name = rest
  |
  +-- Empty/NULL --> first_name = "", last_name = ""
```

### Rate Limiting (IMPORTANT)

The Create User API is rate-limited. For migrations with >1000 users, implement batching:

```
Batch size?
  |
  +-- < 100 users --> No delay needed
  |
  +-- 100-1000 --> 100ms delay between requests
  |
  +-- > 1000 --> Use SDK method for bulk import if available, or 200ms delay
```

Check fetched docs for current rate limits — they may have changed.

### Import Pattern (Pseudocode)

For each user in export:

1. Call SDK method for Create User with:
   - `email` from Better Auth `email`
   - `email_verified` from Better Auth `emailVerified`
   - `first_name` and `last_name` from parsed `name`
2. If password hash exists:
   - Set `password_hash_type` to `'scrypt'` (or your algorithm)
   - Set `password_hash` to PHC-formatted hash
3. Handle response:
   - If 429 (rate limit) → back off and retry
   - If 409 (user exists) → log and continue
   - If 4xx (validation error) → log user ID and error for manual review

**Trap:** Do NOT fail the entire migration on a single user error. Log and continue.

## Step 6: Migrate Social Auth Users

### Provider Account Export

Query the `account` table for social auth accounts:

```sql
SELECT userId, providerId, providerAccountId
FROM account
WHERE providerId != 'credential';
```

### Provider Configuration (Decision Tree)

For each unique `providerId` in your export:

```
providerId value?
  |
  +-- 'google' --> Configure Google OAuth in WorkOS Dashboard
  |
  +-- 'microsoft' --> Configure Microsoft OAuth in WorkOS Dashboard
  |
  +-- 'github' --> Configure GitHub OAuth in WorkOS Dashboard
  |
  +-- Other --> Check fetched docs for supported providers
```

**IMPORTANT:** Social auth users are automatically linked by email address when they sign in through WorkOS. You do NOT need to explicitly import provider account mappings.

### Email Verification Behavior (Trap Warning)

After migration, social auth users may need to verify their email UNLESS:

- Provider is known to verify emails (e.g., Google with gmail.com domain)
- Email verification is disabled in WorkOS environment settings

Check your WorkOS environment's authentication settings to confirm email verification behavior.

## Step 7: Migrate Organizations (Optional)

Only proceed if you used Better Auth's organization plugin.

### Organization Creation

For each organization in export:

1. Call SDK method for Create Organization with:
   - `name` from Better Auth `name`
   - Check fetched docs for slug mapping (Better Auth uses `slug`, WorkOS may use different field)
2. Store the WorkOS organization ID for membership import

### Membership Import

For each member in export:

1. Map Better Auth `userId` to WorkOS user ID (from Step 5 import)
2. Map Better Auth `organizationId` to WorkOS org ID (from organization creation)
3. Call SDK method for Create Organization Membership with:
   - User ID
   - Organization ID
   - Check fetched docs for role mapping (Better Auth role names may differ from WorkOS role slugs)

**Trap:** Better Auth roles may not map 1:1 to WorkOS roles. Create a mapping table before importing:

```
Better Auth role --> WorkOS role slug
'owner'          --> 'admin' or 'owner' (check your WorkOS roles)
'admin'          --> 'admin'
'member'         --> 'member'
```

## Verification Checklist (ALL MUST PASS)

Run these checks AFTER import completes:

```bash
# 1. Verify user count matches
# Compare: SELECT COUNT(*) FROM user; (Better Auth)
# To: WorkOS Dashboard user count or List Users API

# 2. Test password authentication
# Pick 3 random users, attempt sign-in with known passwords

# 3. Test social auth flow
# Sign in with a social provider account that existed in Better Auth
# Verify it links to the correct user

# 4. If migrated orgs: verify org count
# Compare: SELECT COUNT(*) FROM organization; (Better Auth)
# To: WorkOS Dashboard organization count

# 5. If migrated orgs: verify membership count
# Compare: SELECT COUNT(*) FROM member; (Better Auth)
# To: WorkOS organization membership totals
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** Password hash not in PHC string format.

Fix:
1. Check exported hash format — if it's missing `$scrypt$` prefix, it's raw
2. Convert to PHC format: `$scrypt$ln=<cost>,r=<block_size>,p=<parallelization>$<salt>$<hash>`
3. Check fetched docs for default Better Auth scrypt parameters if unknown

### Rate limit 429 errors

**Root cause:** Importing too fast.

Fix:
1. Implement exponential backoff: wait 1s, then 2s, then 4s before retry
2. Reduce batch size
3. Check fetched docs for current rate limits — they may have increased

### User already exists (409)

**Expected behavior** if re-running migration. This is NOT an error.

Fix: Log the conflict and continue. Do NOT attempt to update the existing user unless you have a specific merge strategy.

### "Organization role not found"

**Root cause:** Better Auth role name doesn't exist in WorkOS.

Fix:
1. List available WorkOS roles in Dashboard
2. Create a role mapping table (see Step 7 trap warning)
3. If Better Auth role has no equivalent, choose the closest WorkOS role or create a custom role in WorkOS first

### Social auth users not linking automatically

**Root cause:** Email mismatch or email verification required.

Fix:
1. Check that Better Auth `email` exactly matches the email from the social provider
2. Check WorkOS environment settings for email verification requirements
3. If provider is not known-verified (e.g., GitHub), users may need to verify email manually

### Missing organization memberships after import

**Root cause:** userId or organizationId mapping failed.

Fix:
1. Verify you stored WorkOS user IDs during Step 5 import
2. Verify you stored WorkOS organization IDs during organization creation
3. Check Better Auth `member.userId` and `member.organizationId` foreign keys are valid
4. Re-import memberships with corrected ID mappings
