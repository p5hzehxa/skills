<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The migration docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

Answer these questions to determine your migration strategy:

```
Can you export password hashes?
  |
  +-- Yes --> Which algorithm?
  |     |
  |     +-- bcrypt/scrypt/firebase-scrypt/ssha/pbkdf2/argon2 --> Import directly
  |     |
  |     +-- Other (md5, sha1, proprietary) --> Use password reset flow
  |
  +-- No (security policy, technical limitation) --> Use password reset flow
  |
  +-- N/A (passwordless or social-only) --> Skip password migration

Do users sign up during migration window?
  |
  +-- Yes, high volume --> Use dual-write strategy
  |
  +-- Yes, low volume --> Disable signups temporarily
  |
  +-- No (planned downtime) --> Big-bang migration

Do users authenticate via social providers?
  |
  +-- Yes --> Configure OAuth providers in WorkOS Dashboard BEFORE importing users
  |
  +-- No --> Skip OAuth setup
```

**Critical:** Password reset flow is NOT inferior to hash import. Many apps use it as primary strategy to avoid exporting sensitive data.

## Step 3: WorkOS Environment Setup

### Create User Management Environment

In WorkOS Dashboard:
1. Navigate to User Management section
2. Create environment (development/staging/production as needed)
3. Note `WORKOS_CLIENT_ID` (starts with `client_`)

### Configure Authentication Methods

Based on Step 2 decisions, enable in Dashboard:
- Password authentication (if importing passwords OR using reset flow)
- OAuth providers (Google, Microsoft, GitHub, etc. — see Dashboard integrations page)
- Magic Auth (if replacing passwords)
- Email verification settings (affects social auth linking behavior)

**Verify:** Test OAuth provider with a dummy account before bulk migration. Misconfigured OAuth = users cannot link accounts.

## Step 4: Export User Data (Source System)

### Required Fields

Extract from your current system:
- `email` (primary key for WorkOS)
- `email_verified` (boolean)
- `first_name`, `last_name` (optional but recommended)
- `password_hash` (if importing passwords)
- Social provider identifiers (if users have OAuth accounts)

### Password Hash Format

If exporting hashes, confirm algorithm is supported:
- bcrypt
- scrypt
- firebase-scrypt
- ssha
- pbkdf2
- argon2

**Trap:** Some systems (e.g., AWS Cognito, legacy LDAP) don't expose hashes. This is a SOURCE system limitation, not a WorkOS limitation. Use password reset flow instead.

### Export Verification

```bash
# Check export completeness before proceeding
wc -l users_export.json
# Compare with source system user count

# Validate required fields exist
jq -r '.[] | select(.email == null or .email == "")' users_export.json
# Empty output = all users have emails
```

## Step 5: User Import Strategy (Choose One)

### Option A: Single-Pass Import (Simple, Downtime Required)

1. Schedule maintenance window
2. Disable signups/logins in current system
3. Run import script (Step 6)
4. Deploy code using WorkOS for auth
5. Re-enable access

**Use when:** Small user base (<10k users), acceptable downtime (1-4 hours).

### Option B: Dual-Write (Complex, No Downtime)

1. Deploy code that writes new users to BOTH systems
2. Run import script for historical users (Step 6)
3. Monitor for import conflicts (users created during migration)
4. After import complete, switch to WorkOS-only auth
5. Remove dual-write code

**Use when:** Signups cannot be interrupted, large user base.

**Trap:** Dual-write requires synchronizing updates (email changes, password resets) across systems until cutover. Add sync logic or accept eventual consistency window.

### Option C: Gradual Rollout (Most Complex, Safest)

1. Implement dual-write (Option B)
2. Use feature flag to route NEW signups → WorkOS
3. Import historical users in batches (by cohort, geography, etc.)
4. Gradually shift existing users to WorkOS auth
5. Monitor error rates per batch before proceeding

**Use when:** Mission-critical app, risk-averse org, need rollback capability.

## Step 6: Import Users to WorkOS

### Import Script Pattern (Pseudocode)

```
For each user in export:
  payload = {
    email: user.email,
    email_verified: user.email_verified,
    first_name: user.first_name,
    last_name: user.last_name
  }
  
  # Password handling (conditional)
  If importing hashes:
    payload.password_hash = user.password_hash
    payload.password_hash_type = "bcrypt" # or detected algorithm
  
  # Call WorkOS Create User API
  response = SDK.createUser(payload)
  
  # Persist WorkOS user ID
  database.update(user.id, workos_user_id: response.id)
  
  # Error handling
  If response.error:
    If error.code == "user_already_exists":
      # Dual-write scenario - user created after export
      workos_user = SDK.getUser(email: user.email)
      database.update(user.id, workos_user_id: workos_user.id)
    Else:
      log_error(user.email, response.error)
      # Decide: fail fast or continue with errors
```

Check fetched docs for exact Create User API parameters and error codes.

### Rate Limiting Strategy

```bash
# Import with controlled rate (adjust based on WorkOS rate limits)
while read -r user_json; do
  curl -X POST https://api.workos.com/user_management/users \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -d "$user_json"
  sleep 0.1  # 10 req/sec - adjust based on docs
done < users_export.jsonl
```

**Verify import progress:**

```bash
# Check WorkOS user count matches source
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.metadata.total_count'
```

## Step 7: Handle Password Migration (If Applicable)

### Option A: Import Hashes Directly

Include `password_hash` and `password_hash_type` in Create User payload (Step 6).

Users can log in immediately with existing passwords.

### Option B: Trigger Password Resets

After importing users WITHOUT passwords:

```
For each user:
  SDK.sendPasswordResetEmail(user.email)
  # Or batch operation if SDK supports
```

**Communication strategy:** Email users BEFORE migration explaining password reset requirement. Include "Why are we doing this?" context to reduce support burden.

**Trap:** Password reset emails may be marked spam if sent in bulk. Use:
- Authenticated sending domain
- Gradual send rate (not all users at once)
- Pre-warning email from marketing system

Check fetched docs for Password Reset API usage and rate limits.

## Step 8: Configure OAuth Provider Linking

If users previously authenticated via Google, Microsoft, GitHub, etc.:

### Dashboard Configuration

1. Navigate to WorkOS Dashboard → Redirects
2. Add OAuth callback URL: `https://your-app.com/auth/callback`
3. Navigate to Integrations
4. Configure each provider's client credentials (see provider-specific docs)

### Auto-Linking Behavior

WorkOS links social auth accounts to users by **email address match**:

```
User signs in with Google (email: alice@example.com)
  |
  +-- WorkOS user exists with email: alice@example.com
  |     |
  |     +-- Email verified by provider (e.g., @gmail.com domain) --> Auto-link
  |     |
  |     +-- Email NOT verified by provider --> Require email verification first
  |
  +-- No WorkOS user with that email --> Create new user
```

**Trap:** If user's email in social provider differs from email in your system, linking will fail. Users must update email in one system or manually re-link.

Check fetched docs for which OAuth providers are trusted for email verification.

## Step 9: Deploy Application Code Changes

### Auth Implementation Checklist

Replace existing auth calls with WorkOS SDK:

- [ ] Login endpoint → WorkOS authorization flow
- [ ] Signup endpoint → WorkOS Create User API
- [ ] Password reset → WorkOS Password Reset API
- [ ] User profile updates → WorkOS Update User API
- [ ] Session management → WorkOS session tokens

### Database Schema Migration

Add `workos_user_id` column to user table:

```sql
ALTER TABLE users ADD COLUMN workos_user_id VARCHAR(255);
CREATE INDEX idx_workos_user_id ON users(workos_user_id);
```

**Critical:** Preserve existing user IDs. WorkOS user ID is supplementary, not replacement.

### Environment Variables

Set in production:

```bash
WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
```

**Verify:**

```bash
# Test API key works
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1

# Expect 200 response with user data
```

## Step 10: Cutover and Monitoring

### Cutover Sequence (Big-Bang)

1. Deploy WorkOS-enabled code (auth disabled via feature flag)
2. Verify deployment health (no crashes, no auth calls yet)
3. Enable WorkOS auth via feature flag
4. Disable old auth system
5. Monitor error rates for 1 hour

### Cutover Sequence (Dual-Write)

1. Switch feature flag: new signups → WorkOS only
2. Monitor for 24 hours
3. Gradually route existing users → WorkOS auth (by cohort)
4. After 100% on WorkOS, remove old auth code

### Monitoring Checklist

```bash
# Failed login rate (expect spike, then normalize)
# Track by error code to identify patterns

# User creation rate
# Should match pre-migration baseline

# Password reset requests
# Expect spike if using reset flow

# OAuth linking failures
# Email mismatches or misconfigured providers
```

**Rollback plan:** Keep old auth system code for 30 days. Feature flag allows instant rollback if critical issue detected.

## Verification Checklist (ALL MUST PASS)

Run these checks post-migration:

```bash
# 1. User count matches source system
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | \
  jq '.metadata.total_count'

# 2. Sample user can log in
# Manual test: attempt login with known user credentials

# 3. OAuth provider linking works
# Manual test: sign in with Google/Microsoft using migrated user email

# 4. Password reset flow works
# Manual test: trigger reset, receive email, complete flow

# 5. New user signup works
# Manual test: create account with new email

# 6. Database has workos_user_id populated
psql -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NOT NULL;"
# Should equal total user count
```

## Error Recovery

### "user_already_exists" during import

**Cause:** User created in WorkOS between export and import (dual-write scenario).

**Fix:** Query WorkOS for existing user by email, persist WorkOS user ID, continue import.

### OAuth linking fails with "email not verified"

**Cause:** Social provider does not verify email (e.g., generic OIDC provider).

**Fix:** 
1. Check WorkOS Dashboard → Authentication Settings → Email verification
2. User must complete email verification in WorkOS before linking
3. Or disable email verification requirement (less secure)

### Password hashes not imported (users cannot log in)

**Cause:** Incorrect `password_hash_type` parameter or unsupported algorithm.

**Fix:**
1. Check fetched docs for supported algorithms and exact parameter names
2. Re-import affected users with correct hash type
3. Or trigger password reset for affected users

### Rate limit errors during bulk import

**Cause:** Exceeded WorkOS API rate limits.

**Fix:**
1. Check fetched docs for current rate limits
2. Add exponential backoff to import script
3. Reduce import concurrency (sleep between requests)

### "authorization_code not found" errors post-migration

**Cause:** Stale sessions or cookie domain mismatch.

**Fix:**
1. Clear user cookies (force logout)
2. Verify OAuth callback URL matches deployed app URL exactly (protocol, domain, path)
3. Check redirect URI in WorkOS Dashboard matches code configuration

### Missing workos_user_id in database

**Cause:** Import script failed silently or didn't persist IDs.

**Fix:**
1. Check import script logs for errors
2. Re-run import with "update if exists" logic (idempotent)
3. Verify database transaction commits in import script

### Social auth users cannot sign in (account not found)

**Cause:** Email in OAuth provider differs from email in migrated user record.

**Fix:**
1. User must update email in social provider to match, OR
2. Manually link accounts via WorkOS Dashboard, OR
3. Re-import user with OAuth provider email

## Related Skills

- workos-authkit-nextjs — Next.js integration patterns for WorkOS auth
- workos-authkit-react — Client-side auth components for React apps
