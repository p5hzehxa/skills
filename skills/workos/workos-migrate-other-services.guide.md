<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration from Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Assessment

### User Store Analysis

Determine what data your current system can export:

```
Can you export password hashes?
  |
  +-- YES → Which algorithm? (bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)
  |   |
  |   +-- Supported by WorkOS → Use Import Path (Step 4A)
  |   |
  |   +-- NOT supported → Use Password Reset Path (Step 4B)
  |
  +-- NO (security policy, technical limitation) → Use Password Reset Path (Step 4B)
  |
  +-- DON'T WANT (moving to passwordless) → Skip password handling
```

### Social Auth Inventory

List providers currently in use:

- Google, Microsoft, GitHub, etc.
- Note: WorkOS matches by **email address** during social login
- Check fetched docs for supported provider integrations

### Cutover Strategy Decision

```
Can you disable signups during migration?
  |
  +-- YES → Single-phase migration (Step 3A)
  |   Simpler, requires maintenance window
  |
  +-- NO → Dual-write strategy (Step 3B)
      More complex, zero downtime
```

## Step 3A: Single-Phase Migration (Maintenance Window)

### Timeline

1. **T-minus 24h**: Announce maintenance window to users
2. **T=0**: Disable signup/login in application (feature flag recommended)
3. **T+5min**: Export all users from current system
4. **T+10min**: Import users to WorkOS (Step 4)
5. **T+15min**: Deploy code pointing auth to WorkOS
6. **T+20min**: Enable signup/login, remove flag
7. **T+30min**: Verify first successful login

### Feature Flag Pattern

```
if (featureFlags.maintenanceMode) {
  return "System undergoing maintenance. Back at [time]";
}
```

**Verification**: Attempt signup during Step 2 — should be blocked.

## Step 3B: Dual-Write Strategy (Zero Downtime)

### Phase 1: Add Dual-Write to New Signups

Deploy code that creates users in BOTH systems:

```
On new user signup:
  1. Create user in existing system
  2. Create matching user in WorkOS via Create User API
  3. Store WorkOS user ID alongside local user record
```

**Critical**: If user updates email/password before Phase 3, update BOTH systems.

### Phase 2: Batch Import Historical Users

Export users created BEFORE Phase 1 deployment. Import to WorkOS (Step 4).

**Trap**: Some users will already exist in WorkOS from Phase 1. The Create User API will return error for duplicates — this is expected. Log and skip these.

### Phase 3: Switch Authentication

Deploy code to use WorkOS for authentication. Disable dual-write logic.

**Verification**: New signups should only write to WorkOS.

## Step 4A: Import Path (With Password Hashes)

### Field Mapping

Map your user data to WorkOS User object:

```
Your field          → WorkOS field
email               → email (required)
first_name          → first_name
last_name           → last_name
email_verified      → email_verified
password_hash       → encrypted_password
hashing_algorithm   → password_hash_type (bcrypt, scrypt, etc.)
```

### Import Script Pattern

```
For each user in export:
  Call Create User API with:
    - email
    - first_name, last_name (if available)
    - email_verified: true (if your system verified it)
    - encrypted_password: hash_value
    - password_hash_type: algorithm_name

  Store returned user_id alongside local user record
```

**Verification**: Query WorkOS API for user count — should match export count minus any create failures.

## Step 4B: Password Reset Path (No Hash Export)

### Import Users Without Passwords

Call Create User API for each user with ONLY:

- email
- first_name, last_name (if available)
- email_verified: true (critical — prevents extra verification step)

Do NOT include password fields.

### Trigger Password Resets

After import completes, iterate through users and call Password Reset API. This sends reset emails to all users.

**Timing consideration**: Space out reset emails to avoid overwhelming support. Batch in groups of 1000 per hour.

**User communication**: Send advance email explaining:

- "We're upgrading authentication"
- "You'll receive a password reset link"
- "Your account is secure — this is expected"

**Verification**: Check WorkOS Dashboard for password reset email send count.

## Step 5: Configure Social Auth Providers

### Provider Setup

For each provider currently in use (Google, Microsoft, GitHub):

1. WorkOS Dashboard → Integrations
2. Configure provider credentials
3. Check fetched docs for provider-specific setup

### Email Matching Behavior

When user signs in via social provider post-migration:

```
User logs in with Google
  |
  +-- Email matches WorkOS user → Auto-linked, login succeeds
  |
  +-- Email NOT verified by provider → User must verify via WorkOS
      (Example: Custom domain, non-Gmail addresses)
```

**Trap**: Users with unverified emails will see extra verification step. This is NOT a bug — it's WorkOS security policy.

## Step 6: Deploy Authentication Code

Update authentication logic to use WorkOS:

- Replace login calls with WorkOS SDK sign-in method
- Replace signup calls with WorkOS SDK user creation
- Update session management to use WorkOS sessions
- Remove old authentication code (after verification period)

Check fetched docs for SDK integration patterns for your framework.

## Verification Checklist (ALL MUST PASS)

Run these checks post-migration:

```bash
# 1. User count matches
echo "Expected: $(count_users_in_export)"
echo "WorkOS: $(curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length')"

# 2. Test login with migrated user (use test account)
# Attempt login via WorkOS — should succeed without password reset

# 3. Test social auth (if applicable)
# Sign in via Google/Microsoft — should auto-link to existing user

# 4. Test new signup
# Create new user via application — should appear in WorkOS Dashboard

# 5. Application builds successfully
npm run build  # or equivalent
```

**If check #2 fails for password-based user**: Either hash import failed, or user needs password reset (expected for Step 4B path).

## Error Recovery

### "User already exists" during import

**Root cause**: User was created during dual-write phase (Step 3B) or previous import attempt.

**Fix**: Log and skip. Do NOT treat as failure. Verify user exists in WorkOS Dashboard.

### "Unsupported password hash type"

**Root cause**: Your hash algorithm isn't in WorkOS supported list.

**Fix**: Switch to password reset path (Step 4B). No other option for unsupported algorithms.

### Social login creates new user instead of linking

**Root cause**: Email address mismatch between provider and WorkOS user record.

**Fix**:

1. Verify email in WorkOS user matches EXACTLY (case-sensitive)
2. Check user didn't change email between export and social login
3. If emails match but still failing, check fetched docs for provider-specific email field name

### Users report "verify your email" after social login

**Root cause**: Provider doesn't guarantee email verification (e.g., custom domains, enterprise accounts).

**Expected behavior**: This is WorkOS security policy, not a bug. User must verify once.

**Fix**: Document this in migration announcement. Set `email_verified: true` during import if YOUR system verified the email.

### Password login fails for imported users

**Root cause**: Hash import failed silently or hash parameters missing.

**Debug**:

```bash
# Check if encrypted_password field exists for user
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users/user_123
```

**Fix**: If password missing, trigger password reset for affected users.

### Import script rate limited

**Root cause**: Create User API has rate limits (check fetched docs for current limits).

**Fix**: Add delay between batches:

```bash
for batch in $(split_users_into_batches 100); do
  import_batch $batch
  sleep 2  # 2 second delay between batches
done
```

### Dual-write fails for one system

**Root cause**: Network issue or system downtime during Phase 1 (Step 3B).

**Fix**:

1. Log the failure with user identifier
2. Continue — do NOT block signup
3. After stability restored, manually sync missing users from logs

**Critical**: If WorkOS write fails, store user in local system anyway. Fix WorkOS record in Phase 2.

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
