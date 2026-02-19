<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Cognito Export Access

Verify AWS CLI credentials:

```bash
aws cognito-idp list-user-pools --max-results 1
```

If this fails, configure AWS credentials before proceeding.

### WorkOS SDK

Confirm SDK is installed:

```bash
# Node.js
ls node_modules/@workos-inc/node 2>/dev/null || npm list @workos-inc/node

# Python
python -c "import workos" 2>/dev/null || pip show workos

# Ruby
gem list workos 2>/dev/null
```

If missing, install SDK for your runtime.

## Step 3: Migration Strategy Decision Tree

```
What are you migrating?
  |
  +-- Email/password users only
  |     |
  |     +-- Password hashes available? --> NO (Cognito limitation)
  |     |                                   Use Step 4 (trigger resets)
  |     |
  |     +-- Password hashes available? --> Check fetched docs for hash import
  |
  +-- OAuth users (Google, Facebook, etc.)
  |     |
  |     +-- Use Step 5 (OAuth provider migration)
  |
  +-- Both
        |
        +-- Follow Step 4 for email/password
        +-- Follow Step 5 for OAuth
```

**CRITICAL:** AWS Cognito does NOT export password hashes. WorkOS supports importing password hashes, but you cannot get them from Cognito. Plan for password resets.

## Step 4: Email/Password Migration (No Hashes)

### 4.1: Export Users from Cognito

Export user list with identifiers:

```bash
aws cognito-idp list-users \
  --user-pool-id <pool-id> \
  --attributes-to-get email,email_verified,sub > cognito-users.json
```

Parse output to extract:
- `email` (unique identifier)
- `email_verified` (boolean)
- `sub` (Cognito user ID - save for reference mapping)

### 4.2: Create Users in WorkOS

For each user in export:

1. Call User Management API to create user with email
2. Map `email_verified` from Cognito to WorkOS
3. Store Cognito `sub` as custom user attribute if needed for reference

**Pattern (pseudocode):**

```
for user in cognito_export:
  workos.users.create(
    email: user.email,
    email_verified: user.email_verified,
    # Check fetched docs for exact method signature
  )
```

Check fetched docs for exact SDK method name and parameters.

### 4.3: Trigger Password Resets

**Decision: When to trigger?**

```
Password reset strategy?
  |
  +-- Proactive (immediate)
  |     |
  |     +-- Send password reset emails to all migrated users
  |     +-- Use WorkOS Password Reset API
  |     +-- Check fetched docs for rate limits
  |
  +-- Lazy (on first login)
        |
        +-- Add flag to user profile: needs_password_reset=true
        +-- In login flow: if flag set, redirect to reset flow
        +-- Clear flag after successful reset
```

**Proactive approach pattern:**

```
for user in migrated_users:
  workos.passwordReset.sendResetEmail(
    email: user.email
    # Check fetched docs for exact method signature
  )
  sleep(rate_limit_delay)  # Avoid rate limits
```

Check fetched docs for:
- Exact password reset API endpoint/method
- Rate limits and batch guidance
- Email template customization options

### 4.4: User Communication

**CRITICAL:** Notify users BEFORE migration if triggering proactive resets.

Email template must include:
- Why they're receiving a password reset
- That their account has been migrated
- Instructions to check spam folder
- Support contact

**Trap:** Do NOT migrate silently and trigger resets — users will think it's phishing.

## Step 5: OAuth Provider Migration

### 5.1: Identify OAuth Connections in Cognito

List identity providers configured in Cognito:

```bash
aws cognito-idp list-identity-providers \
  --user-pool-id <pool-id> > cognito-providers.json
```

For each provider (Google, Facebook, etc.), extract:
- Provider type
- Client ID
- Client Secret

### 5.2: Configure Providers in WorkOS

Navigate to WorkOS Dashboard:
1. Go to Authentication → SSO
2. For each Cognito provider:
   - Create matching connection in WorkOS
   - **CRITICAL:** Use SAME Client ID and Client Secret from Cognito
   - This allows seamless migration without re-requesting user consent

### 5.3: Add WorkOS Redirect URIs to Providers

For EACH OAuth provider (Google, Facebook, etc.):

1. Log into provider's developer console
2. Find OAuth application settings
3. Add WorkOS callback URL to allowed redirect URIs
4. **Keep** existing Cognito callback URL active during migration

**Pattern for finding callback URL:**

Check fetched docs or WorkOS Dashboard for your environment's callback URL format.

Typical format: `https://api.workos.com/sso/oauth/callback`

**Migration period:** Run both Cognito and WorkOS redirect URIs in parallel until cutover complete.

### 5.4: Export OAuth User Mappings

Export users who authenticate via OAuth:

```bash
aws cognito-idp list-users \
  --user-pool-id <pool-id> \
  --filter "identities.providerName = \"Google\"" > oauth-users.json
```

For each OAuth user, extract:
- Email (primary identifier)
- Provider name (Google, Facebook, etc.)
- Provider user ID (sub)

### 5.5: Create Users in WorkOS

**Pattern (pseudocode):**

```
for user in oauth_user_export:
  workos.users.create(
    email: user.email,
    email_verified: true,  # OAuth users are pre-verified
    # Check fetched docs for linking OAuth identity
  )
```

Check fetched docs for how to link OAuth provider identity to WorkOS user.

**CRITICAL:** OAuth users do NOT need password resets — their auth happens via provider.

## Step 6: Verification and Cutover

### Pre-Cutover Checklist

Run these commands to confirm migration readiness:

```bash
# 1. Verify user count matches
cognito_count=$(aws cognito-idp list-users --user-pool-id <pool-id> | jq '.Users | length')
echo "Cognito users: $cognito_count"
# Compare to WorkOS user count from Dashboard or API

# 2. Verify OAuth providers configured
# Check WorkOS Dashboard: Authentication → SSO
# Confirm each Cognito provider has matching WorkOS connection

# 3. Test password reset flow
# Manually trigger reset for test user, confirm email delivery

# 4. Test OAuth login flow
# Attempt OAuth login, confirm redirect chain works
```

### Cutover Steps

```
Cutover sequence:
  |
  1. Deploy application code pointing to WorkOS
  |
  2. Update DNS/routing to new auth endpoints
  |
  3. Monitor error logs for 24 hours
  |
  4. After 7 days: Remove Cognito redirect URIs from OAuth providers
  |
  5. After 30 days: Decommission Cognito user pool
```

**DO NOT skip monitoring period.** OAuth misconfigurations manifest as redirect loops.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches (within margin for test users)
# Manual check: Compare Cognito list-users count to WorkOS Dashboard

# 2. OAuth providers configured
grep "Authentication" workos-dashboard-screenshot.txt  # Placeholder - manual verification

# 3. Password reset emails delivering
# Send test reset, check inbox and spam

# 4. OAuth login succeeds
curl -I https://your-app.com/auth/google  # Should redirect to Google, then back

# 5. No Cognito SDK imports remain in codebase
grep -r "aws-cognito" src/ || echo "PASS: No Cognito imports"

# 6. Environment variables updated
grep "WORKOS_API_KEY" .env || echo "FAIL: WorkOS keys missing"
! grep "COGNITO_USER_POOL_ID" .env || echo "WARNING: Cognito keys still present"
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in WorkOS or partial migration run.

**Fix:**
1. Check if user exists in WorkOS Dashboard
2. If duplicate, use update API instead of create
3. If from failed migration, delete WorkOS user and retry

### OAuth redirect loop after migration

**Cause:** Callback URL not added to provider's allowed list.

**Fix:**
1. Log into provider console (Google, Facebook, etc.)
2. Check OAuth application settings
3. Verify WorkOS callback URL is in allowed redirect URIs
4. Clear browser cookies and retry

### Password reset emails not delivering

**Cause:** WorkOS email domain not verified or landing in spam.

**Fix:**
1. Check WorkOS Dashboard: Settings → Email
2. Verify custom email domain is configured
3. Add SPF/DKIM records if using custom domain
4. Test with different email provider (Gmail vs corporate)

### "Invalid credentials" errors post-migration

**Cause:** OAuth provider credentials mismatch between Cognito and WorkOS.

**Fix:**
1. Compare Client ID in WorkOS Dashboard vs Cognito config
2. Re-enter Client Secret in WorkOS (it may have been truncated)
3. Check provider console for credential expiry

### User count mismatch after migration

**Cause:** Filtered export missed some users or rate limiting.

**Fix:**
1. Re-run Cognito export without filters
2. Check for users in multiple Cognito states (unconfirmed, archived)
3. Export in batches if pool has >10k users (check fetched docs for pagination)

## Related Skills

- workos-authkit-react - Implementing auth UI after migration
- workos-authkit-nextjs - Next.js auth integration post-migration
