---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This guide is source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Migration Planning (Decision Tree)

```
Can you export password hashes?
  |
  +-- YES --> Path A: Import with hashes (Step 3A)
  |
  +-- NO  --> Path B: Trigger password resets (Step 3B)
  |
  +-- REMOVING PASSWORDS --> Path C: Skip password handling entirely
```

**Critical decision:** This choice affects user experience. Path A = seamless migration, Path B = users must reset passwords, Path C = forces different auth method.

## Step 3A: User Import with Password Hashes

### Supported Hash Algorithms

Check fetched docs for current list. Known supported:
- bcrypt
- scrypt
- firebase-scrypt
- ssha
- pbkdf2
- argon2

**If your hash algorithm is not listed:** Contact WorkOS support BEFORE starting migration.

### Import Pattern (Pseudocode)

```typescript
for each user in existingUserStore {
  response = workos.users.create({
    email: user.email,
    password_hash: user.hashedPassword,
    password_hash_type: "bcrypt", // match your algorithm
    // additional fields per API reference
  })
  
  // CRITICAL: Persist WorkOS user ID for mapping
  localDB.update(user.id, { workos_user_id: response.id })
}
```

**Key fields to map:**
- Email (required for matching)
- First/last name (if available)
- Email verification status
- Password hash + algorithm

**Verification after each batch:**
```bash
# Check user exists in WorkOS
curl "https://api.workos.com/users/{user_id}" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 3B: User Import WITHOUT Password Hashes

Create users first, trigger password resets second:

### Phase 1: Create Users

```typescript
for each user in existingUserStore {
  response = workos.users.create({
    email: user.email,
    email_verified: user.emailVerified,
    // NO password fields
  })
  
  localDB.update(user.id, { workos_user_id: response.id })
}
```

### Phase 2: Trigger Password Resets

**Timing:** Can happen immediately OR on first login attempt after cutover.

Check fetched docs for Password Reset API usage pattern. Pseudocode:

```typescript
for each user in migratedUsers {
  workos.passwordResets.create({
    email: user.email
    // password reset options per API reference
  })
}
```

**User experience:** Users receive password reset email. Must complete flow to access account.

## Step 4: Social Auth User Linking

### Automatic Linking Behavior

WorkOS links social auth users by **email address match**. No manual linking required.

### Pre-Migration Requirements

1. Configure OAuth providers in WorkOS Dashboard (Google, Microsoft, GitHub, etc.)
2. Check fetched docs for provider-specific setup guides
3. Verify redirect URIs match your application's callback endpoints

### Email Verification Caveat

**Known verified domains:** Users signing in with Google OAuth + gmail.com domain skip extra verification.

**Unknown domains:** Users may need to verify email if environment settings require it.

**Check:** WorkOS Dashboard > Environment Settings > Email Verification to see your policy.

## Step 5: Handling New Users During Migration (Decision Tree)

```
Can you afford signup downtime?
  |
  +-- YES --> Strategy A: Disable signups (simpler)
  |
  +-- NO  --> Strategy B: Dual-write (complex but no downtime)
```

### Strategy A: Disable Signups

**Pattern:**
1. Deploy feature flag to block new signups
2. Export all users from existing store
3. Import all users to WorkOS (Step 3A or 3B)
4. Switch authentication to WorkOS
5. Re-enable signups (now writing to WorkOS only)

**Pros:** Simple, no sync issues
**Cons:** Temporary signup disruption

**Verification before cutover:**
```bash
# Count users in both systems — should match
wc -l exported_users.csv
curl "https://api.workos.com/users?limit=1000" -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
```

### Strategy B: Dual-Write

**Pattern:**
1. Update signup code to write to BOTH systems simultaneously
2. Continue normal operations while migrating historical users
3. Import historical users to WorkOS (some will already exist — handle gracefully)
4. Switch authentication to WorkOS
5. Remove dual-write logic (now WorkOS only)

**Pseudocode for dual-write signup:**
```typescript
async function createUser(email, password) {
  // Create in legacy system
  const legacyUser = await legacyDB.users.create({ email, password })
  
  // ALSO create in WorkOS
  const workosUser = await workos.users.create({ 
    email, 
    password_hash: hashPassword(password),
    password_hash_type: "bcrypt"
  })
  
  // Link the two
  await legacyDB.users.update(legacyUser.id, { 
    workos_user_id: workosUser.id 
  })
  
  return legacyUser
}
```

**Critical:** Also dual-write email updates, password changes, profile edits until migration complete.

**Pros:** No signup downtime
**Cons:** Complex sync logic, risk of drift

### Which Strategy to Choose?

```
User base size + signup volume?
  |
  +-- Small (<10k users, <10 signups/day) --> Strategy A
  |
  +-- Large (>10k users, >10 signups/day) --> Strategy B
  |
  +-- Mission-critical 24/7 app --> Strategy B
```

## Step 6: Field Mapping Reference

Map your existing user fields to WorkOS User object structure:

**Common mappings:**
- `user.email` → `email` (required)
- `user.firstName` → `first_name`
- `user.lastName` → `last_name`
- `user.emailVerified` → `email_verified`
- `user.profileImage` → check fetched docs for profile field support

**Check fetched docs** for complete User object schema — field names vary.

## Step 7: Cutover Execution

### Pre-Cutover Checklist

Run these commands BEFORE switching to WorkOS auth:

```bash
# 1. Verify WorkOS SDK installed
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 2. Verify environment variables
[ -n "$WORKOS_API_KEY" ] && echo "PASS: API key set" || echo "FAIL: Missing WORKOS_API_KEY"
[ -n "$WORKOS_CLIENT_ID" ] && echo "PASS: Client ID set" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 3. Verify user count matches
echo "Check: User counts match between systems"

# 4. Test auth flow in staging
echo "Manual: Complete sign-in flow in staging environment"
```

**Do not proceed to cutover until ALL checks pass.**

### Cutover Steps

1. **Deploy WorkOS authentication code** (do NOT remove legacy auth yet)
2. **Feature flag: route 5% of logins to WorkOS** for smoke testing
3. **Monitor error rates** for 1-2 hours
4. **Increase to 50%** if error rate acceptable
5. **Full cutover to 100%** after validation
6. **Remove legacy authentication code** after 24-48 hours of stable operation

**Rollback plan:** Keep legacy auth code deployed for 48 hours. If issues arise, flip feature flag back.

## Step 8: Post-Migration Validation

### User Experience Verification

Test these flows manually:

1. Existing user signs in with password (Path A users)
2. Existing user completes password reset (Path B users)
3. Existing social auth user signs in with Google/Microsoft
4. New user signs up
5. User updates email address
6. User updates password

**Each flow must work** before declaring migration complete.

### Data Integrity Checks

```bash
# 1. Check for users without WorkOS ID mapping
# (adjust query for your database)
echo "SELECT COUNT(*) FROM users WHERE workos_user_id IS NULL"

# 2. Check for orphaned WorkOS users
curl "https://api.workos.com/users?limit=1000" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[].email' > workos_emails.txt
# Compare with local database emails

# 3. Monitor authentication error rates
echo "Check application logs for auth failures over 24-hour period"
```

**Expected results:**
- Zero users without WorkOS ID mapping (if dual-write strategy)
- No orphaned users in WorkOS
- Auth error rate < 0.1% (excluding intentional test failures)

## Error Recovery

### "User already exists" during import

**Cause:** Dual-write created user before batch import reached them.

**Fix:** 
```typescript
try {
  await workos.users.create(userData)
} catch (error) {
  if (error.code === "user_already_exists") {
    // Fetch existing user by email, persist ID mapping
    const existingUser = await workos.users.listUsers({ email: userData.email })
    localDB.update(localUserId, { workos_user_id: existingUser.data[0].id })
  } else {
    throw error
  }
}
```

### "Unsupported hash algorithm"

**Cause:** Your password hash algorithm not in WorkOS supported list.

**Fix:** Switch to Path B (password resets) OR contact WorkOS support for algorithm addition.

### Social auth user cannot sign in

**Root causes:**
1. OAuth provider not configured in WorkOS Dashboard
2. Email domain requires verification and user hasn't verified
3. Email mismatch between legacy system and OAuth provider

**Debug:**
```bash
# Check user's email in WorkOS
curl "https://api.workos.com/users?email={user_email}" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Check email_verified field
# Check OAuth provider configuration in Dashboard
```

### High error rate after cutover

**Immediate action:** Rollback feature flag to 0% (route to legacy auth).

**Root cause checklist:**
- Environment variables missing in production
- WorkOS API keys incorrect or expired
- Session/cookie configuration incompatible
- Missing WorkOS user ID mappings in database

**Fix before retrying cutover.**

### "Cannot find user" errors

**Cause:** User exists in legacy system but not imported to WorkOS.

**Fix:** 
1. Check Step 5 strategy — did new signups occur during migration?
2. Re-run import for missing users
3. Verify WorkOS user ID mappings persisted correctly

## Related Skills

- **workos-authkit-nextjs** — Integrate WorkOS authentication in Next.js apps
- **workos-authkit-react** — Integrate WorkOS authentication in React apps
