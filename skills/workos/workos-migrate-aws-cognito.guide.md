<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

### Authentication Method Inventory

Map each user authentication method in Cognito to migration strategy:

```
Cognito Auth Method?
  |
  +-- Username/Password --> Bulk import user attributes only
  |                         (Cognito limitation: no hash export)
  |                         → Force password reset after migration
  |
  +-- Federated Identity --> Re-use existing OAuth credentials
  |   (Google, SAML, etc.)  (Client ID + Secret stay same)
  |                         → Add WorkOS redirect URI to provider
  |
  +-- MFA enabled --------> Export user attributes only
                            (Cognito limitation: no MFA key export)
                            → Users must re-enroll MFA in WorkOS
```

**CRITICAL:** AWS Cognito does not export password hashes or MFA keys (Cognito platform limitation). WorkOS supports hash import for other providers, but since Cognito won't export them, all migrated users must reset passwords.

### Migration Timing Strategy

Choose password reset timing:

```
Business requirement?
  |
  +-- Minimize user friction --> Reactive reset
  |                              (prompt at next login attempt)
  |                              → Use WorkOS Send Password Reset Email API
  |                                triggered by failed auth
  |
  +-- Security/compliance -----> Proactive reset
                                 (send reset emails immediately)
                                 → Bulk call Send Password Reset Email API
                                   for all migrated users
```

## Step 3: Export Users from Cognito

### Extract User Pool Data

Use AWS CLI to export user attributes:

```bash
# List all users with their attributes
aws cognito-idp list-users \
  --user-pool-id <your-pool-id> \
  --output json > cognito_users.json
```

**What gets exported:**

- User identifiers (username, email)
- Profile attributes (name, phone, custom attributes)
- Account status (enabled/disabled)
- Creation/modification timestamps

**What does NOT export:**

- Password hashes (Cognito limitation)
- MFA secrets (Cognito limitation)
- OAuth tokens (expire anyway)

### Transform for WorkOS Schema

Map Cognito attributes to WorkOS User fields. Check fetched docs for complete User object schema.

Common mappings:

- `Username` → `email` (if email-based) or custom identifier
- `Attributes` array → WorkOS top-level fields
- `Enabled` status → account active/inactive flag

## Step 4: Import Users into WorkOS

### Bulk User Creation

Use WorkOS Create User API for each exported user. Check fetched docs for exact endpoint and request schema.

**Request pattern (language-agnostic):**

```
for each cognito_user:
  workos.user_management.users.create({
    email: cognito_user.email,
    first_name: cognito_user.given_name,
    last_name: cognito_user.family_name,
    email_verified: cognito_user.email_verified,
    // NO password field - Cognito doesn't export hashes
  })
```

**CRITICAL:** Do NOT include `password` or `password_hash` fields. Cognito does not export these values.

### Error Handling During Import

- **Duplicate email:** User already exists in WorkOS. Decide: skip, update, or fail.
- **Invalid email format:** Log and skip, fix in source data, or use alternate identifier.
- **Rate limiting:** Implement exponential backoff. Check fetched docs for rate limits.

## Step 5: Migrate Federated Identity Connections

### OAuth Provider Re-Use

For users who authenticated via Google, GitHub, Microsoft, etc.:

1. **Reuse existing OAuth app credentials** from Cognito
2. Configure the SAME `Client ID` and `Client Secret` in WorkOS Dashboard
3. **Add WorkOS redirect URI** to the OAuth provider

**Example for Google OAuth:**

- Original Cognito callback: `https://your-domain.auth.region.amazoncognito.com/oauth2/idpresponse`
- New WorkOS callback: Check fetched docs for WorkOS redirect URI format
- Add BOTH to Google OAuth app (keep Cognito active during migration)

Check fetched docs for WorkOS redirect URI patterns and provider-specific setup.

### SAML Connections

For enterprise SAML connections:

- Export SAML metadata from Cognito connection
- Create equivalent connection in WorkOS Dashboard
- Update IdP with new WorkOS ACS URL and Entity ID
- Check fetched docs for WorkOS SAML configuration requirements

## Step 6: Implement Password Reset Flow

### Reactive Reset (Next Login)

Trigger reset when migrated user attempts to sign in:

```
User authentication flow:
  |
  +-- Email exists in WorkOS? --> Check "migrated_from_cognito" flag
      |
      +-- YES --> workos.user_management.password_reset.send_password_reset_email({
      |           user_id: user.id
      |           })
      |           Return: "Check your email to set password"
      |
      +-- NO ---> Normal auth flow
```

Check fetched docs for Send Password Reset Email API endpoint and request schema.

### Proactive Reset (Immediate)

Send reset emails to all migrated users immediately after import:

```bash
# Pseudocode for bulk reset
for each imported_user:
  workos.user_management.password_reset.send_password_reset_email({
    user_id: imported_user.id
  })
  rate_limit_delay() # Respect API limits
```

**Add user metadata** during import to track migration status:

```
{
  "migrated_from": "cognito",
  "migration_date": "2024-01-15",
  "password_reset_sent": false
}
```

## Step 7: AuthKit Integration

**CRITICAL:** After user data migration, integrate WorkOS AuthKit into your application. This is separate from data migration.

### Choose Framework Integration

Pick the AuthKit skill matching your stack:

- **Next.js App Router (13+):** workos-authkit-nextjs
- **React (SPA):** workos-authkit-react
- **React Router:** workos-authkit-react-router
- **TanStack Start:** workos-authkit-tanstack-start
- **Vanilla JS:** workos-authkit-vanilla-js
- **Custom/Other:** workos-authkit-base

Each integration requires `WORKOS_COOKIE_PASSWORD` (32+ characters) for session management across all server-side SDKs.

### Update Authentication Endpoints

Replace Cognito SDK calls with WorkOS AuthKit patterns:

- **Sign in:** Use AuthKit UI component (handles password reset flow)
- **Sign out:** Use SDK sign-out method
- **Protected routes:** Use SDK middleware/guards
- **User profile:** Fetch from WorkOS User Management API

Check the relevant AuthKit skill for implementation steps.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Confirm user export from Cognito
jq 'length' cognito_users.json # Should show user count

# 2. Verify WorkOS user count matches
# Use WorkOS Dashboard or API to confirm imported user count

# 3. Test password reset flow
# Attempt login with migrated user email
# Confirm reset email received and link works

# 4. Verify OAuth providers
# Test sign-in with each federated identity provider
# Confirm redirect to WorkOS, then back to app

# 5. Check AuthKit integration
# Follow verification checklist from AuthKit skill
```

**All checks must pass before production cutover.**

## Error Recovery

### "User already exists" during import

**Cause:** Email collision with existing WorkOS user.

**Fix:**

1. Check if existing user is from previous migration attempt
2. If yes: Use Update User API instead of Create User
3. If no: Resolve email conflict (different identifier, merge accounts, or fail)

### Password reset email not received

**Causes:**

- Email marked as spam (WorkOS uses SendGrid)
- Invalid email in user record
- Email delivery rate limiting

**Fix:**

1. Check user's email field in WorkOS Dashboard
2. Verify email domain accepts mail from WorkOS (SPF/DKIM)
3. Check SendGrid delivery logs in WorkOS Dashboard (if available)
4. Retry with rate limiting: wait 1 minute between retries

### OAuth provider returns "redirect_uri_mismatch"

**Cause:** WorkOS callback URL not added to OAuth provider.

**Fix:**

1. Get WorkOS redirect URI from fetched docs
2. Add to provider's allowed redirect URIs (Google Console, GitHub Settings, etc.)
3. Keep old Cognito URI active until migration complete
4. Test with new URI before removing Cognito URI

### Users can't authenticate after migration

**Likely causes:**

- Password reset flow not implemented (migrated users have no password)
- AuthKit not integrated (still using Cognito SDK)
- Session cookies pointing to old Cognito domain

**Fix checklist:**

1. Confirm password reset flow triggers for migrated users
2. Confirm AuthKit integration replaced Cognito SDK calls
3. Clear all user sessions (force re-authentication)
4. Check browser cookies for old Cognito session tokens

### MFA users lose 2FA after migration

**Cause:** Cognito does not export MFA secrets (Cognito platform limitation).

**Expected behavior:** Users must re-enroll MFA in WorkOS.

**Fix:**

1. Document MFA re-enrollment requirement in user communication
2. Provide MFA setup instructions after password reset
3. Check fetched docs for WorkOS MFA enrollment API

### Rate limit errors during bulk import

**Cause:** Exceeded WorkOS API rate limits.

**Fix:**

1. Implement exponential backoff: start with 1s delay, double on each 429 response
2. Batch users into smaller groups (e.g., 100 users per batch)
3. Check fetched docs for current rate limits
4. Consider requesting rate limit increase from WorkOS support for large migrations

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-react-router
- workos-authkit-tanstack-start
- workos-authkit-vanilla-js
- workos-authkit-base
