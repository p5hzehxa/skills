<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### Database Access

- Confirm you have direct database access (psql, MySQL client, or ORM connection)
- Confirm you can export data as JSON or CSV
- Identify your database type (Postgres, MySQL, SQLite, etc.)

### Better Auth Schema

Verify these tables exist in your database:

- `user` - core user data
- `account` - provider credentials and password hashes
- `organization` (optional) - if using organization plugin
- `member` (optional) - user-to-org mappings

### WorkOS Environment

Check `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Test API key with a simple SDK call before migration.

## Step 3: Export User Data (Decision Tree)

```
Migration scope?
  |
  +-- Passwords needed? --> Export user + account tables
  |                          (account WHERE providerId = 'credential')
  |
  +-- Social auth only?  --> Export user table only
  |
  +-- Organizations?     --> Export user + organization + member tables
```

### Export Commands by Database Type

**Postgres:**

```bash
# Users
psql -d your_db -c "COPY (SELECT * FROM user) TO STDOUT WITH CSV HEADER" > users.csv

# Passwords
psql -d your_db -c "COPY (SELECT userId, password FROM account WHERE providerId = 'credential') TO STDOUT WITH CSV HEADER" > passwords.csv

# Organizations (if needed)
psql -d your_db -c "COPY (SELECT * FROM organization) TO STDOUT WITH CSV HEADER" > orgs.csv
```

**MySQL:**

```bash
mysql -u user -p -D your_db -e "SELECT * FROM user" > users.csv
mysql -u user -p -D your_db -e "SELECT userId, password FROM account WHERE providerId = 'credential'" > passwords.csv
```

**Via ORM (Prisma example):**

```javascript
// export-users.js
const users = await prisma.user.findMany();
const accounts = await prisma.account.findMany({
  where: { providerId: "credential" },
});
fs.writeFileSync("users.json", JSON.stringify(users));
fs.writeFileSync("passwords.json", JSON.stringify(accounts));
```

**Verify:** Exported files contain data before continuing.

## Step 4: Password Hash Format Detection (CRITICAL)

Better Auth defaults to `scrypt`, but supports custom algorithms. You MUST determine which algorithm your instance uses.

### Detection Steps

1. Check Better Auth config for custom `hashPassword` function
2. If custom → identify algorithm (bcrypt, argon2, pbkdf2)
3. If no custom function → assume `scrypt` (default)

### Scrypt Hash Format (Most Common Case)

Better Auth stores scrypt hashes. Check if they're in PHC string format:

```
PHC format example:
$scrypt$ln=16,r=8,p=1$saltbase64$hashbase64

Non-PHC format:
Just the raw hash bytes or hex string
```

**If NOT in PHC format:** You need to convert before import. Check fetched docs for PHC conversion requirements — you'll need:

- Salt (from Better Auth hash)
- Hash output
- Parameters: ln (CPU cost), r (block size), p (parallelization)

### Alternative Algorithms

If Better Auth uses bcrypt, argon2, or pbkdf2:

- WorkOS supports all these — check fetched docs for format requirements
- Each has different PHC parameter names
- Do NOT attempt to convert between algorithms — import in original format

## Step 5: Import Users (Rate Limit Aware)

Use Create User API to import. **Critical:** API is rate-limited — implement batching for large migrations.

### Field Mapping (Better Auth → WorkOS)

| Better Auth Field | WorkOS API Parameter                  |
| ----------------- | ------------------------------------- |
| `email`           | `email`                               |
| `emailVerified`   | `email_verified`                      |
| `name`            | Split into `first_name` + `last_name` |

### Name Splitting Logic

Better Auth stores full name in single `name` field. WorkOS requires split:

```
Name splitting decision tree:
  |
  +-- Contains space? --> Split on first space
  |                       (first_name = before, last_name = after)
  |
  +-- No space?      --> first_name = name, last_name = ""
```

### Import Script Pattern (Language-Agnostic)

```
For each user in exported data:
  1. Split name into first_name + last_name
  2. Find matching password hash (if any) by userId
  3. Call workos.users.create({
       email: user.email,
       email_verified: user.emailVerified,
       first_name: firstName,
       last_name: lastName,
       password_hash: passwordHash (if exists),
       password_hash_type: 'scrypt' (or detected type)
     })
  4. If rate limit error (429) → wait 60 seconds, retry
  5. Log failures for manual review
```

### Batching Recommendation

- Process 100 users per batch
- Add 1-second delay between batches
- Check fetched docs for current rate limits

## Step 6: Social Auth Provider Setup (If Applicable)

If Better Auth `account` table contains rows with `providerId` values like `'google'`, `'github'`, `'microsoft'`:

1. Identify unique `providerId` values in exported data
2. For each provider, configure OAuth credentials in WorkOS Dashboard
3. Check integrations page in fetched docs for provider-specific setup

**Post-migration behavior:** Users with social auth accounts can sign in via provider. WorkOS automatically links by email address.

**Email verification edge case:** If user's email domain doesn't match provider's verified domains, they may need to verify email. Example: Google OAuth with non-gmail.com domain.

## Step 7: Organization Migration (Optional)

Only if Better Auth organization plugin was enabled.

### Export Organizations

```sql
-- Organizations
SELECT * FROM organization;

-- Members (user-to-org mappings)
SELECT * FROM member;
```

### Import Pattern

```
For each organization:
  1. Create org: workos.organizations.create({ name: org.name })
  2. For each member in this org:
     - Add to org: workos.organizations.add_user(org_id, user_id)
     - Assign role if member.role exists
```

Check fetched docs for exact Organization API methods and role assignment syntax.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration. **Do not mark complete until all pass:**

```bash
# 1. Count users in export vs WorkOS
wc -l users.csv  # Compare to Dashboard user count

# 2. Test password auth (pick random user from export)
# Use WorkOS auth UI to sign in with migrated credentials

# 3. Test social auth (if migrated)
# Sign in via provider, confirm auto-links to user

# 4. Check organizations (if migrated)
# Confirm org count in Dashboard matches export

# 5. Verify email_verified status preserved
# Check random sample of users in Dashboard
```

**If any check fails:** Review import logs for errors. Common issues in Error Recovery below.

## Error Recovery

### "Invalid password hash format"

**Root cause:** Hash not in PHC string format or missing required parameters.

**Fix:**

1. Check if hash is raw bytes/hex instead of PHC string
2. Convert to PHC format: `$scrypt$ln=16,r=8,p=1$salt$hash`
3. Verify parameters match Better Auth config (ln, r, p values)
4. Check fetched docs for PHC format examples by algorithm type

### "Rate limit exceeded" (429 errors)

**Root cause:** Importing too fast without batching.

**Fix:**

1. Add delay between API calls (1 second minimum)
2. Reduce batch size (try 50 users per batch)
3. Implement exponential backoff for retries
4. Check fetched docs for current rate limits

### "User already exists" errors

**Root cause:** Duplicate email addresses or prior failed import.

**Fix:**

1. Check if user exists: workos.users.list({ email })
2. If exists and passwords don't match: use Update User API to set password
3. For duplicates in Better Auth data: decide merge strategy before import

### Social auth users can't sign in

**Root cause:** Provider not configured or email domain mismatch.

**Fix:**

1. Verify OAuth credentials in WorkOS Dashboard for each provider
2. Check callback URLs match application routes
3. For email domain mismatches: User must complete email verification flow

### Name field contains only last name

**Root cause:** Better Auth `name` field didn't contain full name.

**Fix:**

1. Review Better Auth data — confirm `name` field population
2. If many users have single-word names: adjust splitting logic
3. Consider mapping `name` to `last_name` only if pattern consistent

### Organizations not linking users

**Root cause:** User IDs in `member` table don't match imported user IDs.

**Fix:**

1. WorkOS assigns new user IDs on import
2. Build mapping: Better Auth user ID → WorkOS user ID
3. Use mapping when calling add_user for organization members
4. Store mapping in separate file during user import step

## Related Skills

- workos-authkit-nextjs - Set up auth UI after migration
- workos-authkit-react - Client-side auth for SPAs
