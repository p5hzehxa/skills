<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

This is the source of truth for current migration capabilities. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Inventory Current Auth System

Catalog what needs migrating:

```
User authentication data:
  |
  +-- Password hashes? --> Note hashing algorithm (bcrypt, scrypt, etc.)
  |
  +-- Social auth users? --> Note providers (Google, Microsoft, GitHub, etc.)
  |
  +-- Email verification status? --> Note which users are verified
  |
  +-- MFA enabled? --> Note users with MFA
```

**Critical questions to answer:**

1. Can you export password hashes from current system? (Security policy, technical capability)
2. What hashing algorithm is used? (WorkOS supports: bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)
3. Which social auth providers are in use?
4. Can you disable signups during migration, or must you support dual-write?

### WorkOS Setup

Verify in WorkOS Dashboard:

- Organization created
- Environment configured (development vs production)
- API keys generated (`WORKOS_API_KEY` starts with `sk_`)
- `WORKOS_CLIENT_ID` obtained (starts with `client_`)

## Step 3: Choose Migration Strategy (Decision Tree)

```
Can you disable signups for migration window?
  |
  +-- YES --> "Big Bang" strategy (simpler, recommended for smaller apps)
  |     |
  |     +-- Go to Step 4A
  |
  +-- NO --> "Dual Write" strategy (complex, for critical-path apps)
        |
        +-- Go to Step 4B
```

**Trade-offs:**

- **Big Bang:** Simple, one-time import. Requires signup downtime (minutes to hours).
- **Dual Write:** No downtime, but requires maintaining sync between systems until cutover. More code, more edge cases.

## Step 4A: Big Bang Migration Path

### Phase 1: Export Users

From your current system, export to CSV or JSON with these fields:

```
Required:
- email (primary key for WorkOS user matching)
- password_hash (if available)
- password_algorithm (bcrypt/scrypt/etc.)

Optional but recommended:
- first_name
- last_name
- email_verified (boolean)
- created_at
- user_id (your system's ID — store WorkOS ID alongside this)
```

**Trap:** Do NOT include plain-text passwords. If your system doesn't export hashes, skip to password reset strategy (Step 5B).

### Phase 2: Disable Signups

Add feature flag or temporary code block:

```
If signup attempt:
  Return "Maintenance in progress, try again in [timeframe]"
```

Deploy this BEFORE starting import.

### Phase 3: Import to WorkOS

For each user in export file:

```
POST to Create User API
  Required: email
  Optional: first_name, last_name, email_verified, password_hash, password_algorithm

Store response user ID:
  {
    "id": "user_01E4ZCR3C56J083X43JQXF3JK5",
    "email": "user@example.com",
    ...
  }

Map WorkOS ID --> Your system's user ID for future lookups
```

Check fetched docs for exact Create User endpoint and request schema.

**Rate limiting:** Check fetched docs for batch import guidance if you have >10k users.

### Phase 4: Verify Import

```bash
# Count users in WorkOS Dashboard
# Should match export row count

# Spot-check 5-10 users:
# - Email matches
# - Name fields populated
# - Email verification status correct
```

### Phase 5: Re-enable Signups

Remove feature flag, deploy updated code that creates users via WorkOS Create User API.

Go to Step 6 for cutover.

## Step 4B: Dual Write Migration Path

### Phase 1: Implement Dual Write

Update signup flow:

```
On user signup:
  1. Create user in existing system (current flow)
  2. Create matching user in WorkOS via Create User API
  3. Store WorkOS user ID alongside existing user record
  
  If WorkOS call fails:
    Log error, but allow signup to succeed
    Add user to "retry queue" for eventual consistency
```

**Trap:** You must also dual-write for:
- Email changes: Update User API in WorkOS
- Password changes: Update User API with new hash
- Email verification changes: Update User API

### Phase 2: Deploy Dual Write

Deploy to production. New users from this point forward exist in both systems.

### Phase 3: Backfill Historical Users

Export all users created BEFORE dual-write deployment.

Import to WorkOS using same process as Step 4A Phase 3.

**Critical:** Handle conflicts gracefully:
```
If Create User returns "user already exists":
  User was created via dual-write
  Update WorkOS user record with any missing fields from export
  Continue to next user
```

### Phase 4: Verify Consistency

```bash
# Compare user counts:
# Existing system count == WorkOS Dashboard count

# Audit sync:
# All users have workos_user_id field populated
# Sample 50+ users and verify WorkOS record matches existing system
```

### Phase 5: Remove Dual Write

After verification passes, deploy code that ONLY writes to WorkOS.

Go to Step 6 for cutover.

## Step 5: Handle Passwords (Decision Tree)

```
Can you export password hashes?
  |
  +-- YES --> Check algorithm compatibility
  |     |
  |     +-- bcrypt/scrypt/firebase-scrypt/ssha/pbkdf2/argon2
  |     |     |
  |     |     +-- Include in Create/Update User API calls
  |     |
  |     +-- Other algorithm
  |           |
  |           +-- Convert to supported algorithm (if feasible)
  |           +-- OR use password reset flow (Step 5B)
  |
  +-- NO --> Use password reset flow (Step 5B)
```

### Step 5A: Import Password Hashes

If hashes are compatible, include in Create User payload:

```
{
  "email": "user@example.com",
  "password_hash": "$2a$12$...",
  "password_algorithm": "bcrypt"
}
```

Check fetched docs for exact field names and supported algorithms.

### Step 5B: Trigger Password Resets

For users without importable passwords:

```
For each user:
  1. Create user in WorkOS (without password_hash)
  2. Trigger password reset via Password Reset API
  3. User receives email with reset link
```

**Timing options:**
- Immediate: Trigger reset during import (users get email flood)
- On-demand: Trigger reset when user attempts first login after migration

Check fetched docs for Password Reset API endpoint and flow.

**Alternative:** Remove password auth entirely, use Magic Auth (passwordless email links). Check WorkOS AuthKit docs if considering this.

## Step 6: Migrate Social Auth Users

### Step 6A: Configure Providers in WorkOS

For each social provider your app uses:

1. Go to WorkOS Dashboard → Integrations
2. Configure provider (Google, Microsoft, GitHub, etc.)
3. Add OAuth client credentials

Check fetched docs for provider-specific setup guides.

**Related Skills:**
- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js

### Step 6B: Email Matching Behavior

WorkOS auto-links social auth users by email address:

```
User signs in with Google (email: user@example.com)
  |
  WorkOS checks: Does user_01XYZ with email user@example.com exist?
  |
  +-- YES --> Link social auth to existing user
  |
  +-- NO --> Create new user
```

**Email verification trap:**

- If email verification is enabled in WorkOS environment settings:
  - Users from "trusted" providers (Google with gmail.com) skip verification
  - Users from "untrusted" providers must verify email before linking

Check fetched docs for current email verification behavior and trusted provider list.

### Step 6C: Pre-Link Social Accounts (Optional)

If you have social auth user IDs from current system, you can pre-link during import:

Check fetched docs for "Social Connection" or "Linked Account" fields in Create User API. This avoids users re-authenticating with provider.

## Step 7: Authentication Cutover

### Pre-Cutover Verification

```bash
# 1. All users migrated
# Count in WorkOS Dashboard == Count in existing system

# 2. Spot-check user data integrity
# Pick 20 random users, verify fields match

# 3. Test auth flows in staging
# - Password login
# - Social auth login (each provider)
# - Password reset
# - Magic Auth (if enabled)
```

### Cutover Steps

```
1. Deploy code that authenticates users via WorkOS SDK
   - Remove auth logic pointing to old system
   - Keep old system for data lookups only

2. Monitor error rates for 24-48 hours
   - Watch for "user not found" errors
   - Watch for password mismatch errors

3. If error rate is acceptable:
   - Mark old auth system as deprecated
   - Plan decommission timeline
```

**Rollback plan:**

Keep old auth system operational for 30+ days. If critical issues arise, revert to old system while debugging.

## Step 8: Field Mapping Reference

Common field mappings (check fetched docs for exact field names):

```
Your system          --> WorkOS User object
--------------           -------------------
user_id              --> Store as metadata, keep for reference
email                --> email (primary key)
first_name           --> first_name
last_name            --> last_name
email_verified       --> email_verified
created_at           --> created_at
password_hash        --> password_hash (with algorithm)
google_user_id       --> (Check docs for social connection fields)
profile_picture_url  --> profile_picture_url
```

**Custom fields:** Use User metadata for application-specific data not in WorkOS User schema.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches
echo "Existing system users: $(count_users_in_old_system)"
echo "WorkOS users: $(check_workos_dashboard_user_count)"

# 2. Password auth works
# Attempt login with 5 test users (pre-agreed credentials)

# 3. Social auth works
# Attempt Google/Microsoft login with 3 test accounts

# 4. Password reset flow works
# Trigger reset for test user, verify email received and reset completes

# 5. No "user not found" errors in logs
grep "user_not_found" application.log | wc -l  # Should be 0

# 6. Old auth system no longer called
grep "old_auth_system_login" application.log | wc -l  # Should be 0
```

## Error Recovery

### "Password hash algorithm not supported"

**Root cause:** Your system uses hashing algorithm WorkOS doesn't support.

**Fix:**
1. Check fetched docs for current supported algorithms (bcrypt, scrypt, firebase-scrypt, ssha, pbkdf2, argon2)
2. If your algorithm is not listed, use password reset flow (Step 5B) instead of importing hashes
3. OR convert hashes to supported algorithm (requires re-hashing, not always possible)

### "Email verification required" blocks social auth users

**Root cause:** WorkOS environment has email verification enabled, provider is not in trusted list.

**Fix:**
1. Check WorkOS Dashboard → Environment Settings → Email Verification
2. If acceptable, disable email verification temporarily during migration
3. OR accept that users must verify email (extra step, but more secure)
4. Check fetched docs for current trusted provider behavior

### "User already exists" during import

**Root cause:** Dual-write created user, or duplicate email in export.

**Fix:**
1. If dual-write strategy: Expected, use Update User API to sync fields
2. If big-bang strategy: Duplicate email in export, deduplicate before retrying
3. Log WorkOS user ID and continue to next user

### High "user not found" error rate after cutover

**Root cause:** Import missed users, or email mismatch.

**Fix:**
1. Query WorkOS API for specific user by email
2. If user exists but email differs (case sensitivity, whitespace): Update email in WorkOS
3. If user truly missing: Import individual user immediately via Create User API
4. If widespread (>5% of logins): Consider rollback and re-audit export

### Social auth users create duplicate accounts

**Root cause:** Email used for social auth doesn't match email in WorkOS user record.

**Fix:**
1. During import, ensure email field matches EXACTLY what social provider returns (case, domain)
2. Check WorkOS Dashboard → User record → Linked Accounts to see if link failed
3. If mismatch found: Update User email via Update User API to match social provider email

### Password login fails for imported users

**Root cause:** Hash algorithm mismatch, or malformed hash.

**Fix:**
1. Verify `password_algorithm` field in Create User payload matches actual algorithm used
2. Test hash import with single user before batch import
3. If still failing: Trigger password reset for affected users (Step 5B)

### Dual-write creates inconsistent state

**Root cause:** WorkOS Create User succeeded, but existing system failed (or vice versa).

**Fix:**
1. Add retry queue for failed WorkOS writes
2. Periodically audit: Query users with missing `workos_user_id`, retry creation
3. For critical users: Manually create in WorkOS via Dashboard or API

## Related Skills

- workos-authkit-react — Client-side auth with React
- workos-authkit-nextjs — Server-side auth with Next.js
- workos-authkit-vanilla-js — Auth without frameworks
- workos-authkit-base — Core AuthKit concepts
