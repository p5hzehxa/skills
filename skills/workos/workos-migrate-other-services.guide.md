<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Generic Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This is the source of truth for migration patterns. If this skill conflicts with the docs, follow the docs.

## Step 2: Migration Strategy Decision Tree

**CRITICAL:** Choose ONE strategy before proceeding. This choice drives the entire implementation.

```
Can you export password hashes from source system?
  |
  +-- YES --> Which algorithm?
  |           |
  |           +-- bcrypt/scrypt/pbkdf2/argon2/ssha/firebase-scrypt
  |           |     --> Strategy A: Hash Import (Step 3A)
  |           |
  |           +-- Other algorithm (MD5, SHA1, proprietary)
  |                 --> Strategy B: Password Reset Flow (Step 3B)
  |
  +-- NO (security policy, system limitation, etc.)
        --> Strategy B: Password Reset Flow (Step 3B)

Do you want to keep password-based auth?
  |
  +-- NO (moving to Magic Auth / Social only)
        --> Strategy C: Skip Password Migration (Step 3C)
```

**Decision factors:**
- **Hash compatibility:** WorkOS supports bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2. If your source uses these, choose Strategy A.
- **Source system limitations:** Some systems (e.g., Cognito) cannot export hashes. Force Strategy B.
- **Security policy:** Some orgs prohibit hash export. Force Strategy B.
- **Auth method change:** If eliminating passwords entirely, choose Strategy C.

## Step 3A: Hash Import Strategy

**Use when:** Source system exports compatible password hashes.

### User Creation with Password Hash

For each user in source system:

1. Export user data including password hash and algorithm
2. Call WorkOS User API with hash parameters:
   - Check fetched docs for Create User API exact schema
   - Include `encrypted_password`, `password_hash` (algorithm name), and `password_salt` (if applicable)
3. Store returned `user_01...` ID alongside local user record

**Field mapping patterns:**

```
Source field          --> WorkOS field (check docs for exact names)
email                 --> email (primary identifier)
first_name/last_name  --> first_name/last_name
email_verified        --> email_verified (boolean)
created_at            --> Check docs for timestamp format
password_hash         --> encrypted_password
hash_algorithm        --> password_hash (enum: "bcrypt", "scrypt", etc.)
salt (if separate)    --> password_salt
```

**Critical:** Email is the primary matching key. Duplicate emails will cause creation failures.

### Verification Command

```bash
# Test user creation with hash (replace with real values)
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","encrypted_password":"<hash>","password_hash":"bcrypt"}'

# Should return 201 with user_01... ID
```

**Error recovery:**
- `invalid_password_hash`: Algorithm not supported → Switch to Strategy B
- `email_already_exists`: Duplicate in WorkOS → Check dual-write timing
- `invalid_password_hash_format`: Hash encoding issue → Verify base64/hex encoding matches docs

## Step 3B: Password Reset Flow Strategy

**Use when:** Cannot export hashes OR source hash algorithm unsupported.

### Process

1. Create users WITHOUT password data (email + profile only)
2. Programmatically trigger password reset using WorkOS Password Reset API
3. User receives email with reset link
4. User sets new password in WorkOS

**Timing options:**

- **Immediate batch:** Trigger resets for all users during migration (high email volume)
- **Just-in-time:** Trigger reset on first login attempt (spreads load, requires interim auth bridge)

**Implementation pattern:**

```bash
# 1. Create user without password
# 2. Immediately trigger reset flow (check docs for Password Reset API)
# 3. User receives email from WorkOS
```

**Trap warning:** Do NOT trigger resets before users are created. Create user first, THEN reset.

**Error recovery:**
- `user_not_found`: User creation failed → Check Step 3B.1 response
- `email_not_verified`: WorkOS requires verified email for reset → Check environment settings
- Reset email not received: Check WorkOS Dashboard email configuration + spam folders

## Step 3C: Skip Password Migration Strategy

**Use when:** Eliminating password auth entirely (moving to Magic Auth / Social only).

### Process

1. Create users with email + profile only (no password fields)
2. Configure social auth providers in WorkOS Dashboard (Google, Microsoft, etc.)
3. Users sign in via social auth on first access
4. WorkOS auto-links by email address

**Provider configuration checklist:**

- [ ] Provider client ID + secret configured in WorkOS Dashboard
- [ ] Redirect URIs registered with provider
- [ ] Email scope requested (required for auto-linking)
- [ ] Check fetched docs for provider-specific setup guides

**Auto-linking behavior:**

- WorkOS matches social auth email to existing user email
- If provider verifies emails (e.g., Google with @gmail.com), no extra verification
- If provider doesn't verify OR domain doesn't match known-verified list, user must verify via WorkOS email

**Trap warning:** Auto-linking only works if social auth email EXACTLY matches WorkOS user email. Case-sensitive.

## Step 4: Social Auth Continuity (ALL Strategies)

If source system has users who sign in via Google/Microsoft/etc., those users can continue via same provider in WorkOS.

**Critical:** This works ALONGSIDE password migration. A user can have both password + social auth.

### Configuration

1. Identify which social providers your source system uses
2. Configure EACH provider in WorkOS Dashboard (check fetched docs for provider-specific guides)
3. On first WorkOS sign-in via social provider, user auto-links by email

**Verification command:**

```bash
# Check providers configured
# (Manual check in WorkOS Dashboard → Authentication → Social)
```

**Error recovery:**
- User social auth fails but password works: Provider not configured → Check Dashboard
- User sees "link accounts" prompt: Email mismatch between social profile and WorkOS user → Verify email normalization

## Step 5: Handling Interim New Users (Decision Tree)

```
Can you tolerate signup downtime during migration?
  |
  +-- YES (small app, scheduled maintenance acceptable)
  |     --> Strategy D: Disable Signups (Step 5D)
  |
  +-- NO (critical path app, large user base)
        --> Strategy E: Dual-Write (Step 5E)
```

## Step 5D: Disable Signups Strategy

**Use when:** Can schedule maintenance window.

### Process

1. Set feature flag to disable signup form
2. Perform user export from source system
3. Import all users to WorkOS (Steps 3A/B/C)
4. Switch app to use WorkOS for authentication
5. Re-enable signups (now via WorkOS)

**Timeline example:**
- T-1 hour: Disable signups
- T: Start export/import
- T+30 min: Import complete, switch auth to WorkOS
- T+45 min: Test auth flows
- T+60 min: Re-enable signups

**Trap warning:** Users who signed up between export snapshot and disable may be missing. Minimize this window.

## Step 5E: Dual-Write Strategy

**Use when:** Cannot disable signups.

### Process

![Dual-write flow: New signups go to BOTH old system AND WorkOS simultaneously]

1. Update signup code to write to BOTH old system AND WorkOS
2. For each new signup:
   - Create user in old system (existing code)
   - ALSO call WorkOS Create User API
   - Store WorkOS `user_01...` ID alongside old user ID
3. Continue dual-write until historical migration complete
4. Perform bulk import for pre-dual-write users
5. Switch auth to WorkOS-only
6. Remove old system writes

**Implementation pattern:**

```bash
# Pseudocode for signup handler
function createUser(email, password) {
  // Old system
  oldUserId = oldSystem.createUser(email, password)
  
  // New: WorkOS dual-write
  workosUser = workosAPI.createUser(email, password)
  
  // Store both IDs
  db.save({
    old_id: oldUserId,
    workos_id: workosUser.id,
    email: email
  })
}
```

**Critical:** Dual-write must include password OR use Strategy B for these users too.

**Error recovery:**
- WorkOS creation fails but old system succeeds: User exists in old system only → Queue for retry OR handle during bulk import (will be duplicate, use upsert pattern)
- Duplicate user_01 ID: Already created during dual-write → Check fetched docs for Update User API to modify instead

**Update propagation:**

During dual-write period, email/password CHANGES must also dual-write:

```bash
function updateUserEmail(userId, newEmail) {
  oldSystem.updateEmail(userId, newEmail)
  workosAPI.updateUser(workosUserId, { email: newEmail })
}
```

**Trap warning:** If you forget to dual-write updates, users created during dual-write period will have stale data in WorkOS.

## Step 6: Bulk Import Execution

**This is the main migration event.**

### Pre-Flight Checklist

- [ ] Migration strategy chosen (Step 2)
- [ ] Interim user strategy chosen (Step 5)
- [ ] WorkOS API key verified (`sk_` prefix)
- [ ] Test import with 10 users successful
- [ ] Error handling code deployed (rate limits, duplicates)
- [ ] Rollback plan documented

### Execution Pattern

```bash
# Pseudocode for bulk import
for user in exportedUsers:
  try:
    response = workosAPI.createUser({
      email: user.email,
      first_name: user.firstName,
      # Include password hash if Strategy A
      # Omit password if Strategy B/C
    })
    
    db.saveWorkOSId(user.id, response.id)
    
  catch RateLimitError:
    sleep(backoffSeconds)
    retry(user)
    
  catch DuplicateEmailError:
    # User created during dual-write period
    existingUser = workosAPI.getUserByEmail(user.email)
    db.saveWorkOSId(user.id, existingUser.id)
```

**Rate limit handling:** Check fetched docs for API rate limits. Implement exponential backoff.

**Idempotency:** Track which users successfully imported to enable safe retries.

### Verification Commands

```bash
# 1. Count users in old system
echo "Old system user count:"
# Run source system query

# 2. Count users in WorkOS
curl -X GET "https://api.workos.com/user_management/users" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'

# 3. Spot-check user
curl -X GET "https://api.workos.com/user_management/users?email=test@example.com" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**All counts must match** (accounting for dual-write overlap).

## Step 7: Authentication Cutover

**CRITICAL:** Do not cut over until Step 6 verification passes.

### Cutover Pattern

1. Deploy code that uses WorkOS SDK for authentication (check fetched docs for SDK auth methods)
2. Update login form to call WorkOS sign-in
3. Update session management to use WorkOS tokens
4. **Keep old system read-only** for 7-14 days (rollback safety)
5. After stability period, fully decommission old auth system

**Rollback trigger:** If >5% auth failure rate, roll back immediately.

### Verification Commands

```bash
# 1. Test login for migrated user
# (Manual test in browser OR automated E2E test)

# 2. Check session token is WorkOS-issued
# (Inspect token claims - should have WorkOS issuer)

# 3. Monitor auth error rate
# (Check application logs for auth failures)
```

**Error recovery:**
- User login fails, password correct: User not migrated → Check Step 6 logs
- Social auth fails: Provider config missing → Check Step 4
- Email verification loop: WorkOS environment has email verification enabled but user's email not verified → Trigger verification email OR disable verification in Dashboard

## Step 8: Post-Migration Cleanup

**Wait 7-14 days after cutover before cleanup.**

- [ ] Verify zero auth traffic to old system
- [ ] Remove old auth code from codebase
- [ ] Remove dual-write logic (if used)
- [ ] Archive old user database (compliance retention)
- [ ] Update documentation for new auth flow

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count parity
echo "Source count: $(source_system_user_count)"
echo "WorkOS count: $(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length')"

# 2. Password login works (if Strategy A or B)
# Manual test OR automated test

# 3. Social auth works (if configured)
# Manual test for each provider

# 4. New signups create WorkOS users
# Create test user, verify user_01... ID returned

# 5. Zero errors in application logs for 24 hours post-cutover
grep -i "auth.*error" application.log | wc -l  # Should be 0 or baseline rate
```

## Error Recovery

### "email_already_exists" during import

**Root cause:** User created during dual-write period OR duplicate in source data.

**Fix:** Use Update User API instead of Create, OR fetch existing user and store ID.

### "invalid_password_hash" during Strategy A

**Root cause:** Algorithm not supported OR hash encoding wrong.

**Fix:**
1. Verify algorithm is in supported list (bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)
2. Check hash encoding (base64 vs hex) matches docs
3. If algorithm unsupported, switch to Strategy B

### Users can't log in after cutover

**Root cause:** Migration incomplete OR WorkOS session not established.

**Fix:**
1. Check user exists in WorkOS: `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/user_management/users?email=<email>`
2. If missing: User not migrated → Re-run import for missing users
3. If exists but password fails: Hash import failed → Trigger password reset (Strategy B)

### Social auth auto-link fails

**Root cause:** Email mismatch between social profile and WorkOS user.

**Fix:**
1. Check social profile email vs WorkOS user email (case-sensitive)
2. If mismatch: Update WorkOS user email to match social profile
3. If user declines linking: They must use password auth OR create new account

### Rate limit errors during bulk import

**Root cause:** Importing too fast.

**Fix:**
1. Check fetched docs for rate limit
2. Implement exponential backoff (start at 1s, double on each retry)
3. Batch import in smaller chunks with delays

### Password reset emails not received (Strategy B)

**Root cause:** WorkOS email config OR user's spam filter.

**Fix:**
1. Check WorkOS Dashboard email configuration
2. Check user's spam folder
3. Verify user's email is valid and not bouncing
4. Check fetched docs for email delivery logs

## Related Skills

- workos-authkit-nextjs - if migrating a Next.js app
- workos-authkit-react - if migrating a React SPA
- workos-authkit-vanilla-js - if migrating a vanilla JS app
