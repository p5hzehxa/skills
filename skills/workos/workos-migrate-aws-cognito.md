---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

This is the source of truth for migration patterns. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Migration Assessment

### Source System Audit

Check your Cognito User Pool configuration:

```bash
# List all user pools
aws cognito-idp list-user-pools --max-results 60

# Describe target pool (replace POOL_ID)
aws cognito-idp describe-user-pool --user-pool-id POOL_ID
```

Identify authentication methods in use:

```
Auth Method              Action Required
  |
  +-- Username/Password  --> Export users, see Step 3
  |
  +-- OAuth (Google, etc.) --> Preserve OAuth credentials, see Step 5
  |
  +-- SAML                --> See workos-sso-* skills
  |
  +-- Custom Auth Flow    --> Manual migration required
```

### WorkOS Prerequisites

Verify in WorkOS Dashboard:

- Organization created (get `org_id` from URL or API)
- Connection configured for target auth method
- API keys visible: `WORKOS_API_KEY` (starts with `sk_`), `WORKOS_CLIENT_ID` (starts with `client_`)

## Step 3: User Data Export

### Export User List

```bash
# Export all users from Cognito pool
aws cognito-idp list-users \
  --user-pool-id POOL_ID \
  --output json > cognito_users.json
```

### Parse User Attributes

Transform Cognito attributes to WorkOS format:

```
Cognito Field          WorkOS Field
  |
  +-- sub               --> externalId (preserve as-is)
  +-- email             --> email
  +-- email_verified    --> emailVerified
  +-- given_name        --> firstName
  +-- family_name       --> lastName
  +-- custom:*          --> Store in metadata if needed
```

**CRITICAL PASSWORD HASH NOTE:**

Cognito does NOT export password hashes via API. This is a Cognito limitation, not a WorkOS limitation.

WorkOS DOES support importing password hashes if you have them, but since Cognito doesn't export them, you must trigger password resets for username/password users. See Step 4.

## Step 4: User Import Decision Tree

```
Do you have password hashes?
  |
  +-- NO (typical for Cognito)
  |     |
  |     +-- Import users WITHOUT passwords
  |     +-- Trigger password reset flow (see Step 4a)
  |
  +-- YES (from other source)
        |
        +-- Check fetched docs for hash format requirements
        +-- Import with passwordHash field
```

### Step 4a: Bulk User Import (No Passwords)

Use WorkOS Directory Sync API for bulk import:

```bash
# Pseudocode pattern — exact endpoint in fetched docs
for each user in cognito_users.json:
  POST /user_management/users
  {
    "organizationId": "org_...",
    "email": user.email,
    "emailVerified": user.email_verified,
    "firstName": user.given_name,
    "lastName": user.family_name,
    "externalId": user.sub  # Preserve Cognito sub
  }
```

**Verify after each batch:**

```bash
# Check import succeeded
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"organizationId": "org_..."}'
```

### Step 4b: Trigger Password Resets

Two strategies:

**Strategy A: On-demand reset (user-triggered)**

1. User attempts sign-in
2. App detects "migrated from Cognito" flag (store in user metadata)
3. Redirect to password reset flow
4. Use WorkOS Send Password Reset Email API (check fetched docs for endpoint)

**Strategy B: Proactive reset (bulk email)**

1. After import completes, loop through all imported users
2. Call Send Password Reset Email API for each user
3. Track sent emails to avoid duplicates

Pseudocode for bulk reset:

```bash
# Get all imported users
GET /user_management/users?organizationId=org_...

# Send reset email to each
for each user:
  POST /user_management/password_reset
  {
    "email": user.email,
    "passwordResetUrl": "https://yourapp.com/reset-password"  # Your callback URL
  }
```

**Verify reset emails are sent:**

Check WorkOS Dashboard → Events → Filter by `password_reset.requested`

## Step 5: OAuth Provider Migration

### Preserve OAuth Credentials

If migrating users who sign in with Google/Microsoft/GitHub:

1. **Critical:** Use the SAME Client ID and Client Secret in WorkOS that you used in Cognito
2. Go to OAuth provider settings (e.g., Google Cloud Console)
3. Add WorkOS redirect URI to authorized redirects

**Pattern for finding WorkOS redirect URI:**

```bash
# Check fetched docs for exact format, typically:
https://api.workos.com/sso/authorize/callback
```

**Example: Google OAuth**

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Select OAuth 2.0 Client ID used in Cognito
3. Add WorkOS redirect URI to "Authorized redirect URIs"
4. Save and wait 5-10 minutes for propagation

**Verify OAuth works:**

```bash
# Test OAuth flow
curl -X POST https://api.workos.com/sso/authorize \
  -H "Content-Type: application/json" \
  --data '{
    "clientId": "'"$WORKOS_CLIENT_ID"'",
    "redirectUri": "YOUR_CALLBACK_URL",
    "provider": "GoogleOAuth",
    "organizationId": "org_..."
  }'
```

Should return authorization URL. Visit it and complete OAuth flow.

### Configure Connection in WorkOS

For each OAuth provider:

1. WorkOS Dashboard → Authentication → Connections
2. Create new connection matching Cognito provider
3. Enter SAME credentials from Cognito
4. Test connection before cutover

## Step 6: Application Code Migration

### Replace Cognito SDK Calls

Map Cognito SDK methods to WorkOS equivalents:

```
Cognito Method                   WorkOS Pattern
  |
  +-- initiateAuth()             --> Use AuthKit sign-in flow (see workos-authkit-* skills)
  |
  +-- signUp()                   --> POST /user_management/users
  |
  +-- confirmSignUp()            --> Email verification via AuthKit
  |
  +-- forgotPassword()           --> POST /user_management/password_reset
  |
  +-- getUser()                  --> GET /user_management/users/:id
```

### Session Management

Replace Cognito JWT validation with WorkOS session handling:

1. Remove `aws-jwt-verify` or similar packages
2. Install WorkOS SDK for your framework (see Related Skills)
3. Replace token validation logic with WorkOS session checks

Check fetched docs for session management patterns specific to your language.

## Step 7: Cutover Strategy

### Parallel Run (Recommended)

1. Deploy WorkOS integration to production WITHOUT removing Cognito
2. Route NEW users to WorkOS
3. Incrementally migrate existing users on next sign-in
4. Monitor error rates for 1-2 weeks
5. Remove Cognito integration after validation

### Hard Cutover (Faster but Riskier)

1. Schedule maintenance window
2. Export all Cognito users
3. Import to WorkOS (Steps 3-4)
4. Deploy code changes
5. Send password reset emails immediately
6. Monitor closely for 24-48 hours

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User import succeeded
curl -X GET https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length'
# Should match Cognito user count

# 2. OAuth providers configured
# Check WorkOS Dashboard → Connections → Each provider shows "Active"

# 3. Password reset emails sendable
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"email": "test@example.com", "passwordResetUrl": "https://yourapp.com/reset"}'
# Should return 200

# 4. Application builds with WorkOS SDK
npm run build  # or equivalent for your language

# 5. Test sign-in flow end-to-end
# Attempt sign-in with migrated user → should trigger password reset or OAuth flow
```

## Error Recovery

### "User not found" after import

**Root cause:** Import failed silently or used wrong organization ID

**Fix:**

```bash
# Verify organization ID matches
echo $WORKOS_ORG_ID

# Re-check user list
curl -X GET https://api.workos.com/user_management/users?organizationId=$WORKOS_ORG_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### "Invalid OAuth credentials"

**Root cause:** Client ID/Secret mismatch between Cognito and WorkOS, or redirect URI not added to OAuth provider

**Fix:**

1. Compare credentials in Cognito and WorkOS Dashboard
2. Check OAuth provider console for WorkOS redirect URI
3. Wait 5-10 minutes after adding redirect URI
4. Test OAuth flow with verbose logging enabled

### "Password reset email not received"

**Root cause:** Email not verified in WorkOS, or passwordResetUrl missing/malformed

**Fix:**

```bash
# Check user email verification status
curl -X GET https://api.workos.com/user_management/users/:id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
# Look for "emailVerified": true

# Verify passwordResetUrl is absolute URL with https://
# Check WorkOS Dashboard → Events for password_reset.failed
```

### "externalId collision"

**Root cause:** Duplicate Cognito `sub` values or re-importing same users

**Fix:**

1. Query WorkOS for existing externalIds before import
2. Use upsert pattern if supported (check fetched docs)
3. Track imported user IDs to avoid re-import

### Rate limit exceeded during bulk import

**Root cause:** Importing too many users too quickly

**Fix:**

```bash
# Add delay between requests (adjust based on rate limits in fetched docs)
for user in users; do
  import_user $user
  sleep 0.1  # 100ms delay = ~10 req/sec
done

# Or batch import if API supports (check fetched docs)
```

## Related Skills

- **workos-authkit-nextjs** - Integrate WorkOS authentication with Next.js
- **workos-authkit-react** - React-specific AuthKit integration
- **workos-authkit-vanilla-js** - Framework-agnostic AuthKit setup
