<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The fetched documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Migration Strategy Decision Tree

```
Do you need to preserve passwords?
  |
  +-- YES --> Contact Auth0 support for password export (1-2 weeks)
  |           Export will contain bcrypt hashes in passwordHash field
  |           → Proceed to Step 3 with password import
  |
  +-- NO  --> Use Auth0 bulk user export only (available immediately)
              Users will reset passwords on first WorkOS login
              → Proceed to Step 3 without password import
```

**Critical:** Auth0 does NOT export plaintext passwords. Only bcrypt hashes are available via support ticket.

## Step 3: Export User Data from Auth0

### Option A: Dashboard Export (No passwords)

1. Auth0 Dashboard → User Management → Users
2. Export as JSON (newline-delimited format)
3. Result: User metadata only (email, names, email_verified)

### Option B: Support Ticket (With passwords)

1. Contact Auth0 support via https://auth0.com/docs/troubleshoot/customer-support
2. Request: "Bulk user export including password hashes"
3. Wait: 1-2 weeks typical turnaround
4. Result: Separate JSON file with `passwordHash` field per user

**Trap:** Requesting passwords AFTER starting user export adds 1-2 weeks to migration timeline. Decide upfront.

## Step 4: Import Users to WorkOS

### Field Mapping

Map Auth0 export fields to WorkOS User Creation API:

```
Auth0 field       → WorkOS parameter
─────────────────────────────────────
email             → email
email_verified    → email_verified
given_name        → first_name
family_name       → last_name
passwordHash      → password_hash (if available)
```

### Implementation Pattern

Choose one:

**Option A: Use WorkOS Migration Tool** (Recommended)

- GitHub: https://github.com/workos/migrate-auth0-users
- Handles rate limiting, retries, progress tracking
- Check repository README for usage instructions

**Option B: Custom Script**

Use WorkOS User Creation API for each user:

```
FOR EACH user in auth0_export.json:
  IF password_hash exists:
    workos.user_management.create_user(
      email: user.email,
      email_verified: user.email_verified,
      first_name: user.given_name,
      last_name: user.family_name,
      password_hash: user.passwordHash,
      password_hash_type: 'bcrypt'
    )
  ELSE:
    workos.user_management.create_user(
      email: user.email,
      email_verified: user.email_verified,
      first_name: user.given_name,
      last_name: user.family_name
    )
```

**Critical:** `password_hash_type` MUST be `'bcrypt'` for Auth0 exports. Other algorithms will fail.

### Handling Existing Users

If user already exists in WorkOS (duplicate email), use Update User API instead:

```
workos.user_management.update_user(
  user_id: existing_user_id,
  password_hash: user.passwordHash,
  password_hash_type: 'bcrypt'
)
```

## Step 5: Application Code Migration

**Decision:** How does your Auth0 integration work today?

```
Auth0 integration type?
  |
  +-- Auth0.js SDK (client-side) --> Migrate to workos-authkit-react or workos-authkit-vanilla-js
  |
  +-- Auth0 Lock widget --> Migrate to WorkOS AuthKit hosted UI
  |
  +-- auth0-node SDK --> Migrate to workos-node SDK with server-side session
  |
  +-- Next.js auth0/nextjs-auth0 --> Migrate to workos-authkit-nextjs (see related skill)
```

Check fetched docs for SDK installation and setup instructions per language.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration readiness:

```bash
# 1. Check Auth0 export file exists and is valid JSON
cat auth0_export.json | jq -e '.email' >/dev/null && echo "✓ valid export" || echo "✗ invalid format"

# 2. Check password hashes present (if migrating passwords)
grep -q "passwordHash" auth0_export.json && echo "✓ passwords included" || echo "✗ passwords missing"

# 3. Count total users to migrate
cat auth0_export.json | wc -l

# 4. Verify WorkOS API key is set and valid format
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid key" || echo "✗ missing/invalid key"
```

**Do not proceed with migration until all checks pass.**

## Error Recovery

### "Passwords not included in export"

**Root cause:** Standard Auth0 export doesn't include password hashes.

**Fix:**

1. Open Auth0 support ticket requesting password export
2. Wait 1-2 weeks for processing
3. Receive separate JSON file with `passwordHash` field
4. Merge password data with user export before importing

**Alternative:** Skip password import, force users to reset passwords on first WorkOS login.

### "Invalid password_hash format" during import

**Root cause:** Wrong `password_hash_type` parameter or corrupted hash.

**Fix:**

1. Verify Auth0 export contains `passwordHash` field (not `password` or other name)
2. Confirm `password_hash_type: 'bcrypt'` in API call
3. Check hash string starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
4. If hash is missing prefix, contact Auth0 support — export may be incomplete

### "User already exists" during bulk import

**Root cause:** Duplicate email addresses or previous partial import.

**Fix:**

1. Check if user exists via WorkOS List Users API filtering by email
2. If exists, use Update User API instead of Create User API
3. Track imported user IDs to resume interrupted migrations
4. Use migration tool from GitHub (handles duplicates automatically)

## Related Skills

After completing user migration, integrate WorkOS authentication:

- workos-authkit-nextjs — For Next.js App Router applications
- workos-authkit-react — For React SPAs
- workos-authkit-vanilla-js — For vanilla JavaScript apps
