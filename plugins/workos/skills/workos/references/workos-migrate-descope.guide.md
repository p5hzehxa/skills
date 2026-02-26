<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:**

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing or invalid"
```

### SDK Installation

Detect package manager, install WorkOS SDK if missing.

**Verify:**

```bash
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: Password Export Decision Tree

```
Does your Descope app use password authentication?
  |
  +-- NO  --> Skip to Step 5 (user import without passwords)
  |
  +-- YES --> Do you need to preserve existing passwords?
              |
              +-- NO  --> Skip to Step 5 (users will reset passwords)
              |
              +-- YES --> Continue to Step 4 (contact Descope support)
```

**Critical:** Descope does NOT expose password hashes via API. Support ticket required.

## Step 4: Request Password Export from Descope

Contact Descope support to request CSV export with password hashes.

When submitting ticket:

- Request which hashing algorithm was used (bcrypt/argon2/pbkdf2)
- Confirm secure transfer method
- Note: This is NOT self-service — support must generate the file

Check fetched docs for Descope support contact link.

## Step 5: User Import Implementation

### Field Mapping

Map Descope export fields to WorkOS User Management API:

| Descope Export Field | WorkOS API Parameter |
| -------------------- | -------------------- |
| `email`              | `email`              |
| `givenName`          | `first_name`         |
| `familyName`         | `last_name`          |
| `verifiedEmail`      | `email_verified`     |

### Password Import (if exported)

Add these parameters when creating users:

- `password_hash` - hash value from Descope export
- `password_hash_type` - algorithm from support (one of: `bcrypt`, `argon2`, `pbkdf2`)

### Rate Limiting Strategy

WorkOS User Management API has rate limits. For bulk imports:

```
User count?
  |
  +-- < 100   --> Sequential import, no batching needed
  |
  +-- 100-1000 --> Batch 50 users, 1s delay between batches
  |
  +-- > 1000  --> Batch 100 users, 2s delay between batches
```

Check fetched docs for current rate limits before implementing.

### Code Example

```javascript
// Import users with passwords (language-agnostic SDK syntax)
users.forEach((descopeUser) => {
  workos.userManagement.createUser({
    email: descopeUser.email,
    firstName: descopeUser.givenName,
    lastName: descopeUser.familyName,
    emailVerified: descopeUser.verifiedEmail,
    passwordHash: descopeUser.passwordHash, // If exported
    passwordHashType: 'bcrypt', // From support ticket
  });
});
```

For exact method signatures, check fetched docs.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check SDK installed
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK missing"

# 2. Check env vars set
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ API key valid" || echo "✗ API key invalid"

# 3. Verify user creation works (test with one user)
# Run your import script with a single test user first

# 4. Check password import parameters (if using)
grep -E "password_hash_type.*['\"]?(bcrypt|argon2|pbkdf2)" your_migration_script.* || echo "WARN: No password hash type found"
```

## Error Recovery

### "Invalid password_hash_type"

**Root cause:** Using algorithm name not supported by WorkOS OR typo in algorithm name.

**Fix:**

1. Confirm Descope support ticket specified one of: bcrypt, argon2, pbkdf2
2. Check for typos: `"bcrypt"` not `"bcrypt_sha256"` or `"bcrypt-sha256"`
3. If Descope used different algorithm, contact WorkOS support before importing

### "Rate limit exceeded" during bulk import

**Root cause:** Importing too many users too quickly.

**Fix:**

1. Add batching: process 50-100 users per batch
2. Add delay: 1-2 seconds between batches
3. Log failed user IDs for retry
4. Resume from last successful batch (idempotent retry)

### "Email already exists"

**Root cause:** Duplicate import attempt OR user already exists in WorkOS.

**Fix:**

1. Check if this is retry of failed batch — skip existing users
2. For genuine duplicates in Descope export: decide which record to keep
3. Use upsert pattern: try create, catch conflict, update if needed

### Missing password hashes in export

**Root cause:** Descope support ticket incomplete OR passwords not requested.

**Fix:**

1. Verify support ticket explicitly requested password hashes
2. Confirm secure transfer method was established
3. Re-open ticket with Descope support if export missing passwords
4. Alternative: Import users without passwords, send reset emails

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
