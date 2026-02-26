<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/better-auth`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Database Schema Detection (Decision Tree)

Better Auth uses multiple tables. Which ones exist in your database?

```
Database schema?
  |
  +-- user + account only
  |     └─> Export: user identities + password hashes
  |
  +-- user + account + organization + member
        └─> Export: user identities + password hashes + org memberships
```

**Critical:** The `account` table stores password hashes. Do NOT skip this table.

## Step 3: Export User Data

Query `user` table for core identity data:

```sql
SELECT id, name, email, emailVerified, image, createdAt, updatedAt
FROM user;
```

Export to JSON or CSV. Map fields for WorkOS import:

- `id` → external user ID for deduplication
- `email` → user identifier in WorkOS
- `emailVerified` → determines if user needs email verification
- `name`, `image` → optional profile metadata

## Step 4: Export Password Hashes

Better Auth stores passwords in `account` table with `providerId = 'credential'`:

```sql
SELECT userId, password
FROM account
WHERE providerId = 'credential';
```

**Critical:** Better Auth uses **scrypt** by default. If you customized the hash algorithm, note it now — you'll need to specify it during WorkOS import.

**Trap:** The `password` column contains the full hash string including algorithm parameters. Do NOT strip prefixes.

## Step 5: Export Organization Data (If Present)

If using Better Auth's organization plugin, export org structure:

```sql
-- Organizations
SELECT id, name, slug, metadata, createdAt
FROM organization;

-- Memberships with roles
SELECT organizationId, userId, role, createdAt
FROM member;
```

Map roles to WorkOS equivalents. Better Auth role strings map directly to WorkOS role slugs (e.g., `admin` → `admin` slug).

## Step 6: Import to WorkOS

Check fetched docs for:

- User Management API import endpoint
- Password hash format specification
- Organization structure import (if applicable)

**Critical decision:** Import order matters:

```
Import sequence?
  |
  +-- Users without orgs
  |     └─> 1. Import users → 2. Import password hashes
  |
  +-- Users with orgs
        └─> 1. Create orgs → 2. Import users → 3. Import password hashes → 4. Assign memberships
```

Use WorkOS User Management API. The SDK method signature varies by language — check fetched docs for exact syntax.

## Step 7: Verification Strategy

Better Auth sessions are stateless (JWT-based). Migration does NOT invalidate existing sessions — users can continue using Better Auth tokens until expiry.

**Post-migration verification:**

```bash
# 1. Check user count matches (replace $WORKOS_API_KEY with your key)
BETTER_AUTH_COUNT=$(sqlite3 auth.db "SELECT COUNT(*) FROM user;")
echo "Better Auth users: $BETTER_AUTH_COUNT"
echo "WorkOS users: (check Dashboard user count)"

# 2. Test password authentication for migrated user
# (Use WorkOS test endpoint from fetched docs)

# 3. Verify org memberships imported (if applicable)
echo "Check WorkOS Dashboard → Organizations → Members"
```

## Error Recovery

### "Password hash format invalid"

**Cause:** Better Auth scrypt hashes have specific parameter encoding.

**Fix:**

1. Export raw `password` column value from `account` table
2. Do NOT modify the hash string (no base64 decode, no prefix stripping)
3. Check fetched docs for WorkOS hash format requirements
4. If mismatch: Better Auth may be using custom scrypt params — check your Better Auth config for `password.config`

### "Email already exists"

**Cause:** Duplicate imports or existing WorkOS users.

**Fix:**

1. Use external user ID from Better Auth `user.id` for deduplication
2. WorkOS import API supports upsert — check fetched docs for `skip_existing` parameter
3. If intentional duplicate: use different email domain or delete existing WorkOS user first

### "Organization not found" during membership import

**Cause:** Orgs not created before assigning members.

**Fix:**

1. Import orgs FIRST (from `organization` table)
2. Map Better Auth `organization.id` to WorkOS org ID in your script
3. Then import memberships with correct WorkOS org IDs

### Better Auth sessions still active after migration

**Not an error.** Better Auth uses JWTs — existing sessions remain valid until expiry. This is expected behavior during transition period.

**If you need immediate cutover:**

1. Rotate Better Auth secret key to invalidate all JWTs
2. Update your app to redirect login flow to WorkOS
3. Communicate session expiry to users

## Related Skills

- workos-authkit-nextjs — if migrating Better Auth from Next.js app
- workos-authkit-react — if migrating Better Auth from React app
