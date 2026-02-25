<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Export Limitations (CRITICAL)

**AWS Cognito does not export:**

- Password hashes (Cognito platform limitation)
- MFA secrets/recovery codes

**Impact:** All migrated users must reset passwords. Plan communication strategy before starting.

WorkOS supports importing password hashes from other providers (bcrypt, scrypt, argon2, pbkdf2, ssha, firebase-scrypt), but since Cognito won't export them, this path is unavailable.

### What CAN be migrated:

- User attributes (email, name, phone, custom attributes)
- OAuth provider connections (Google, Microsoft, etc.)
- Email verification status

## Step 3: Export User Data

Use AWS CLI to export user pool:

```bash
aws cognito-idp list-users \
  --user-pool-id <your-pool-id> \
  --output json > cognito_users.json
```

**Verify export:**

```bash
jq '.Users | length' cognito_users.json
# Should show total user count
```

## Step 4: Password Reset Strategy (Decision Tree)

```
When to reset passwords?
  |
  +-- Reactive (next login) --> Use WorkOS AuthKit's password requirement check
  |                            (user hits login, gets redirect to password reset)
  |
  +-- Proactive (immediate)  --> Loop through users, call Send Password Reset Email API
                                 (users get reset email before attempting login)
```

**Reactive:** Lower friction, but some users may not return for months.
**Proactive:** Ensures all users can login immediately, but requires email delivery monitoring.

Check fetched docs for Send Password Reset Email API endpoint and parameters.

## Step 5: Import Users to WorkOS

Map Cognito user attributes to WorkOS Create User API:

```
cognito_users.json format --> WorkOS User API params

Users[].Username          --> email_address (if email-based)
Users[].Attributes[]      --> Parse to first_name, last_name, email_verified
Users[].UserCreateDate    --> (not imported - WorkOS sets created_at)
```

**Critical:** Do NOT set password field. Users imported without passwords are automatically flagged for password reset.

Use SDK method for user creation with parameters from fetched docs.

## Step 6: Migrate OAuth Connections

### For each OAuth provider in Cognito (Google, Microsoft, etc.):

1. **Reuse existing credentials:**
   - Copy Client ID from Cognito to WorkOS Dashboard
   - Copy Client Secret from Cognito to WorkOS Dashboard

2. **Add WorkOS callback URL to provider:**
   - Go to provider's OAuth settings (e.g., Google Cloud Console)
   - Add WorkOS redirect URI: `https://api.workos.com/sso/oauth/callback`
   - Keep existing Cognito redirect URI during migration

3. **Test OAuth flow:**
   ```bash
   # Should return 302 redirect to provider
   curl -I "https://api.workos.com/sso/authorize?client_id=<client_id>&redirect_uri=<your_callback>&provider=GoogleOAuth"
   ```

**Trap:** OAuth users do NOT need password resets — their provider tokens continue working.

## Step 7: Proactive Password Reset (If Chosen)

Loop through imported users, call Send Password Reset Email API:

```bash
# Pseudocode - check fetched docs for exact endpoint and auth
for user_id in $(jq -r '.Users[].Username' cognito_users.json); do
  curl -X POST https://api.workos.com/user_management/password_reset \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$user_id\"}"
done
```

**Rate limit check:** Monitor for 429 responses, add backoff if needed.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches export
total_exported=$(jq '.Users | length' cognito_users.json)
echo "Exported: $total_exported users"

# 2. OAuth callback URL added to provider
curl -I "https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&provider=GoogleOAuth" | grep "302"

# 3. Password reset emails sent (if proactive)
# Check email delivery logs or WorkOS Dashboard analytics

# 4. Test user can login via OAuth
# Manual test: Attempt Google OAuth login with migrated user
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email or WorkOS organization already has this user.

**Fix:** Check if user was partially migrated in earlier attempt. Use Update User API instead of Create User.

### OAuth provider rejects WorkOS callback

**Cause:** WorkOS redirect URI not whitelisted in provider settings.

**Fix:**

1. Go to provider's OAuth app settings (e.g., Google Cloud Console)
2. Add exact URI: `https://api.workos.com/sso/oauth/callback`
3. Wait 5 minutes for provider cache to clear

### Password reset emails not arriving

**Cause:** Email provider flagging bulk sends as spam, or WorkOS email domain not verified.

**Fix:**

1. Check WorkOS Dashboard email logs for delivery failures
2. Add SPF/DKIM records if using custom email domain
3. Slow down send rate to avoid spam filters (1 req/second max)
