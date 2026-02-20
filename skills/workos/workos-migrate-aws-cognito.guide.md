<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Analysis (Decision Tree)

Inventory your Cognito user base to determine migration strategy:

```
User authentication methods?
  |
  +-- Username/Password only
  |     |
  |     +-- Passwords available? --> Direct import with hashes
  |     |
  |     +-- Passwords NOT available --> Import without hashes + reset flow
  |
  +-- OAuth providers (Google, Facebook, etc.)
  |     |
  |     +-- Check: Same OAuth credentials in WorkOS?
  |           |
  |           +-- YES --> Seamless migration (no re-auth)
  |           |
  |           +-- NO --> Users must re-authenticate
  |
  +-- Mixed (passwords + OAuth) --> Combine strategies above
```

**CRITICAL distinction:**

- **Cognito limitation:** Cognito does NOT export password hashes — this is AWS's restriction
- **WorkOS capability:** WorkOS DOES support importing password hashes IF you can obtain them

Most Cognito migrations require password resets because Cognito won't give you the hashes, not because WorkOS can't accept them.

## Step 3: User Data Export

Export users from Cognito (see fetched docs for AWS CLI commands or console steps).

**Verify export contains:**

- User IDs (sub)
- Email addresses
- Email verification status
- OAuth provider links (if applicable)
- Custom attributes you need to preserve

**Password hash note:** If export contains password hashes (rare — usually Cognito custom auth), you can import them to WorkOS. Otherwise, proceed to password reset strategy.

## Step 4: WorkOS Organization Setup

Create WorkOS organization for your app (see fetched docs for exact steps).

**If migrating OAuth users:**

1. Create OAuth connections in WorkOS Dashboard matching your Cognito providers
2. **CRITICAL:** Use IDENTICAL OAuth credentials (Client ID + Secret) from Cognito
3. Add WorkOS callback URL to OAuth provider's allowed redirect URIs
   - Example for Google: See https://workos.com/docs/integrations/google-oauth (Step 3: Add Redirect URI)
   - Pattern: `https://api.workos.com/sso/oauth/google/callback`

**Why identical credentials matter:** Prevents users from having to re-authenticate. OAuth provider recognizes the existing authorization.

## Step 5: User Import Strategy (Decision Tree)

```
Password hashes available?
  |
  +-- YES (rare with Cognito)
  |     |
  |     +-- Use User Management API to import with hashes
  |     +-- Users sign in immediately with existing passwords
  |
  +-- NO (typical Cognito scenario)
        |
        +-- Import users WITHOUT passwords
        +-- Choose reset trigger:
              |
              +-- Proactive: Send reset emails immediately after import
              |
              +-- Lazy: Trigger reset on first login attempt
```

Check fetched docs for exact User Management API import endpoints and payload formats.

## Step 6: Password Reset Flow Implementation

**For users without password hashes** (standard Cognito migration):

Choose trigger strategy:

### Option A: Proactive Reset (Recommended)

- Import users to WorkOS
- Immediately call Password Reset Email API for each user
- Users receive reset link before attempting login
- Better UX — avoids "your password doesn't work" confusion

### Option B: Lazy Reset

- Import users to WorkOS without passwords
- On login attempt, detect missing password
- Trigger Password Reset Email API
- Redirect to "check your email" page

**API endpoint:** Use WorkOS Password Reset Email API (check fetched docs for exact endpoint and payload).

**Implementation pattern:**

```
POST /user_management/password_reset
{
  "email": "user@example.com",
  "password_reset_url": "https://yourapp.com/reset-password"
}
```

Check fetched docs for exact request structure — this is a simplified example.

## Step 7: OAuth Connection Migration

**For each OAuth provider in Cognito:**

1. **Dashboard setup:**
   - WorkOS Dashboard → Connections → Add OAuth connection
   - Select provider type (Google, Facebook, etc.)
   - Enter SAME Client ID and Client Secret from Cognito

2. **Provider configuration:**
   - Add WorkOS redirect URI to provider's allowed list
   - Format: `https://api.workos.com/sso/oauth/{provider}/callback`
   - See fetched docs for provider-specific instructions

3. **Test before migration:**
   - Verify OAuth flow completes successfully
   - Check user data mapping preserves required attributes

**Trap:** If you use NEW OAuth credentials instead of Cognito's existing ones, users will see consent screens again and may create duplicate accounts.

## Step 8: SDK Integration

Install WorkOS SDK (see fetched docs for language-specific instructions).

**Minimum required endpoints:**

- User authentication
- Password reset (if applicable)
- OAuth callback handling (if applicable)

**Implementation pattern:**

```
// Password reset example (language-agnostic)
workos.userManagement.sendPasswordResetEmail({
  email: userEmail,
  passwordResetUrl: callbackUrl
})

// OAuth redirect example
authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'GoogleOAuth',
  clientId: WORKOS_CLIENT_ID,
  redirectUri: YOUR_CALLBACK_URL
})
```

Check fetched docs for exact SDK method names and parameters — these vary by language.

## Step 9: Gradual Migration Testing

**Do NOT migrate all users at once.** Test with cohorts:

1. **Internal users** (10-20 people)
   - Verify password reset flow
   - Verify OAuth re-authentication (if applicable)
   - Monitor for import errors

2. **Beta group** (100-500 users)
   - Test at scale
   - Monitor authentication error rates
   - Verify email deliverability

3. **Full migration**
   - Batch remaining users
   - Keep Cognito running in parallel for 48h as fallback
   - Monitor WorkOS Dashboard for anomalies

## Verification Checklist (ALL MUST PASS)

Run these checks before marking migration complete:

```bash
# 1. Test password reset flow
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password_reset_url":"https://yourapp.com/reset"}' \
  | jq .

# 2. Verify OAuth connection active (if applicable)
# Check WorkOS Dashboard → Connections → Status = "Active"

# 3. Test SDK authentication
# Run your app's login flow with a migrated test user

# 4. Check email deliverability
# Verify password reset emails arrive within 60 seconds
```

**Manual checks:**

- [ ] At least 10 test users successfully logged in
- [ ] Password reset emails delivered consistently
- [ ] OAuth users authenticated without re-consent (if using same credentials)
- [ ] No spike in authentication errors in WorkOS Dashboard

## Error Recovery

### "User not found" after import

**Root cause:** Import script failed or user data malformed

**Fix:**

1. Check WorkOS Dashboard → Users for actual imported count
2. Verify import payload matches schema in fetched docs
3. Check API response logs for validation errors
4. Re-run import for failed users

### Password reset emails not arriving

**Root causes:**

- Invalid `password_reset_url` format (must be HTTPS)
- Email marked as spam
- Rate limit hit (check API response headers)

**Fix:**

1. Verify URL format: `https://yourdomain.com/reset-password`
2. Check spam folders for test emails
3. Implement retry logic with exponential backoff
4. Check WorkOS Dashboard → Logs for delivery status

### OAuth users see consent screen again

**Root cause:** Using NEW OAuth credentials instead of Cognito's existing ones

**Fix:**

1. Go to WorkOS Dashboard → Connections → [Your OAuth Connection]
2. Replace Client ID and Secret with values from Cognito
3. Users who already re-authenticated will keep new authorizations
4. Future users won't see consent screen

### "Invalid OAuth callback" errors

**Root cause:** WorkOS redirect URI not added to OAuth provider

**Fix:**

1. Find provider's redirect URI configuration (Google Console, Facebook App Settings, etc.)
2. Add: `https://api.workos.com/sso/oauth/{provider}/callback`
3. Wait 5-10 minutes for propagation
4. Test OAuth flow again

### High authentication error rate post-migration

**Root causes:**

- Users trying old passwords (expected if no hash import)
- Mapping errors (email mismatch between Cognito and WorkOS)
- OAuth connection misconfiguration

**Fix:**

1. Check error types in WorkOS Dashboard → Logs
2. If "invalid credentials": expected — password reset flow working as designed
3. If "user not found": audit import for email mapping errors
4. If OAuth errors: verify connection status and credentials

## Related Skills

- workos-authkit-nextjs — for Next.js frontend integration
- workos-authkit-react — for React frontend integration
