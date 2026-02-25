<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Password Strategy Decision Tree

This is the most critical choice in any migration. Choose based on your source system's capabilities:

```
Can you export password hashes?
  |
  +-- YES → Which hashing algorithm?
  |           |
  |           +-- bcrypt/scrypt/pbkdf2/argon2/ssha/firebase-scrypt
  |           |     → Import during user creation (encrypted_password param)
  |           |
  |           +-- Other algorithm (md5, sha1, custom)
  |                 → Cannot import → Use password reset flow
  |
  +-- NO (security policy blocks export)
        |
        +-- Keep passwords? → Trigger password reset via API
        |
        +-- Remove passwords? → Skip password import entirely
                                 (users will use Magic Auth/SSO only)
```

**Implementation mapping:**

- Import path: Use `encrypted_password` + `encrypted_password_hash_type` in Create User API
- Reset path: Call Password Reset API after user creation
- Skip path: Omit password fields entirely, configure Magic Auth in dashboard

## Step 3: Field Mapping Strategy

Map your existing user schema to WorkOS User object. Decision tree for common ambiguities:

```
Where does user's name live in your system?
  |
  +-- Single "name" field → firstName param (WorkOS will parse)
  |
  +-- Separate first/last → firstName + lastName params
  |
  +-- Display name only → firstName param, leave lastName empty

Email verification status?
  |
  +-- Verified in old system → email_verified: true
  |
  +-- Unknown/unverified → email_verified: false (user must reverify)

Social connections?
  |
  +-- OAuth tokens stored → Cannot import (security). User re-authenticates.
  |
  +-- Just provider linkage → Recreate using Manage User Auth Methods API
```

**Critical:** WorkOS user IDs (`user_01...`) are NEW. You MUST persist the mapping:

```
Your DB migration:
  ALTER TABLE users ADD COLUMN workos_user_id VARCHAR(255);
  -- Then in migration script:
  UPDATE users SET workos_user_id = [returned ID from Create User API]
```

## Step 4: Cutover Strategy Decision Tree

```
Migration approach?
  |
  +-- Big Bang (all users at once)
  |     |
  |     +-- Steps:
  |           1. Maintenance window
  |           2. Export all users
  |           3. Bulk import to WorkOS (parallelized)
  |           4. Update app to use WorkOS SDK
  |           5. Deploy
  |
  +-- Gradual (new users only)
  |     |
  |     +-- Steps:
  |           1. Deploy dual-write: create users in BOTH systems
  |           2. Background job: migrate existing users
  |           3. Auth check: try WorkOS first, fallback to old system
  |           4. After 100% migrated: remove old system
  |
  +-- Shadow Mode (test before switching)
        |
        +-- Steps:
              1. Create users in WorkOS (don't use for auth yet)
              2. Run parallel auth checks (log discrepancies)
              3. Fix issues
              4. Flip traffic to WorkOS
```

**Gradual approach pseudocode (most common for production):**

```
// During user creation
new_user = old_system.create_user(email, password)
workos_user = workos.user_management.create_user({
  email: new_user.email,
  first_name: new_user.name,
  encrypted_password: new_user.password_hash,
  encrypted_password_hash_type: "bcrypt"
})
new_user.update(workos_user_id: workos_user.id)

// During authentication
if user.workos_user_id:
  authenticate_via_workos()  // Use WorkOS SDK
else:
  authenticate_via_old_system()  // Fallback
  migrate_user_to_workos()  // Lazy migration
```

## Step 5: User Creation Implementation

For each user in source system, call Create User API. Check fetched docs for exact parameters.

**Common parameters (language-agnostic):**

```
workos.user_management.create_user({
  email: user.email,
  email_verified: user.email_verified,
  first_name: user.first_name,
  last_name: user.last_name,
  encrypted_password: user.password_hash,           // If importing passwords
  encrypted_password_hash_type: "bcrypt"            // Or scrypt, pbkdf2, etc.
})
```

**Save the returned user ID** — you MUST persist `user_01...` in your database.

## Step 6: Password Reset (If Not Importing)

For users where password import failed or is not possible:

```
If password import not possible:
  1. Create user WITHOUT encrypted_password param
  2. Call Password Reset API with user's email
  3. User receives reset email, sets new password
```

Check fetched docs for Password Reset API endpoint.

**Timing:** You can trigger resets during migration OR lazily on first login attempt.

## Step 7: Social Auth Reconnection

**CRITICAL:** OAuth tokens CANNOT be imported for security reasons. Users must re-authenticate.

```
For each social connection in old system:
  1. Create WorkOS user (just email + name)
  2. User logs in via social provider (Google, GitHub, etc.)
  3. WorkOS links the account automatically (email match)
```

You do NOT need to call a separate "link account" API — WorkOS handles this if emails match.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check WorkOS user ID was persisted
echo "SELECT workos_user_id FROM users LIMIT 1" | psql $DB_URL | grep "user_01" && echo "✓ IDs saved" || echo "✗ FAIL: No WorkOS IDs"

# 2. Check password import worked (if applicable)
# Try logging in with an imported user's password — should succeed without reset

# 3. Check Create User API reachable
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' | grep '"id":"user_' && echo "✓ API works" || echo "✗ FAIL: API error"

# 4. Verify migration script handles duplicates
# Re-run migration on same user — should skip or update, not create duplicate
```

## Error Recovery

### "Encrypted password is invalid"

**Root cause:** Hash format mismatch or wrong algorithm type.

Fix:

1. Check source system's ACTUAL hashing algorithm (don't assume)
2. Export a single password hash, test locally: `bcrypt.verify(plain_password, hash)`
3. If verify fails: hash format is corrupted or algorithm is wrong
4. If WorkOS rejects: algorithm not in supported list → use password reset flow instead

### "User with this email already exists"

**Root cause:** Duplicate migration or email collision.

Fix:

1. Check if user already has `workos_user_id` in your DB
2. If yes: skip creation, use existing ID
3. If no: user exists in WorkOS but not linked → call Update User with your metadata
4. Migration script MUST be idempotent — track migration status per user

### Password reset emails not sending

**Root cause:** Email domain not verified or rate limit hit.

Fix:

1. Verify sending domain in WorkOS Dashboard → Settings → Email
2. Check Dashboard logs for delivery errors
3. If bulk sending: batch password resets with delays (10 resets/sec max)

### Social auth users cannot log in

**Root cause:** Email mismatch between WorkOS user and social profile.

Fix:

1. Check WorkOS user email EXACTLY matches social profile email (case-sensitive)
2. If emails differ: update WorkOS user email to match, OR have user log in with different method first
3. WorkOS links accounts by email — if no match, user sees "create new account" flow

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
