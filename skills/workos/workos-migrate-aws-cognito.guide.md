<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Source System Inventory

Check Cognito User Pool:

```bash
# List user pool attributes
aws cognito-idp describe-user-pool --user-pool-id <pool-id> \
  | jq '.UserPool.SchemaAttributes[] | select(.Required==true) | .Name'
```

Document:
- **User attributes** in use (email, phone_number, custom attributes)
- **Authentication flows** enabled (OAuth providers, SAML, username/password)
- **MFA settings** (SMS, TOTP, none)
- **Password policies** (length, complexity requirements)

### OAuth Provider Inventory

If using OAuth providers (Google, Facebook, etc.):

```bash
# List identity providers
aws cognito-idp list-identity-providers --user-pool-id <pool-id>
```

**CRITICAL:** Record Client ID and Client Secret for each provider — you'll reuse these exact credentials in WorkOS.

### Password Hash Export Limitation (IMPORTANT)

**Cognito does not export password hashes.** This is a Cognito limitation, not a WorkOS limitation. WorkOS supports importing password hashes, but Cognito doesn't provide them.

Your options:
1. Force all users to reset passwords after migration
2. Keep Cognito running temporarily for password verification during transition
3. Use Just-In-Time (JIT) migration pattern (verify against Cognito on first login)

Choose strategy now — it affects Step 4.

## Step 3: WorkOS Environment Setup

### Create Organization

In WorkOS Dashboard:
1. Navigate to Organizations
2. Create organization matching your application
3. Note the Organization ID (`org_*`)

### Configure Authentication Methods

Based on Step 2 inventory, enable matching methods:

**Username/Password:**
- Enable Email + Password authentication in organization settings
- Configure password policy to match or exceed Cognito policy

**OAuth Providers:**
- For each provider from Step 2, create connection in WorkOS
- **Use the same Client ID and Client Secret from Cognito** — this preserves existing OAuth tokens
- Add WorkOS redirect URI to provider settings (e.g., for Google: [see Google OAuth integration guide](https://workos.com/integrations/google-oauth))

**Verification:**
```bash
# Confirm organization exists
curl -X GET "https://api.workos.com/organizations/<org-id>" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Step 4: User Data Migration

### Export Cognito Users

```bash
# Export user list with attributes
aws cognito-idp list-users --user-pool-id <pool-id> \
  --attributes-to-get email phone_number given_name family_name \
  > cognito_users.json
```

### Import to WorkOS

Check fetched docs for User Management API bulk import endpoint.

**Map Cognito attributes to WorkOS:**
- `email` → email
- `phone_number` → phone_number  
- `given_name` → first_name
- `family_name` → last_name
- Custom attributes → check docs for custom profile fields

**Decision Tree for Password Strategy:**

```
Password strategy?
  |
  +-- Force reset --> Import without passwords, send reset emails (Step 5)
  |
  +-- JIT migration --> Import metadata only, verify against Cognito on first login
  |
  +-- Dual-run --> Import users, keep Cognito active for password verification window
```

## Step 5: Trigger Password Resets

If forcing password resets, use Send Password Reset Email API immediately after import.

**Batch script pattern:**
```bash
# For each imported user
for email in $(jq -r '.Users[].Attributes[] | select(.Name=="email") | .Value' cognito_users.json); do
  curl -X POST "https://api.workos.com/user_management/password_reset" \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password_reset_url\":\"https://yourapp.com/reset\"}"
done
```

**Critical:** Set `password_reset_url` to your application's reset handler, not WorkOS default.

Check fetched docs for exact API endpoint path and request schema.

## Step 6: Application Integration

### AuthKit Integration (Decision Tree)

```
Frontend framework?
  |
  +-- Next.js App Router --> Use skill: workos-authkit-nextjs
  |
  +-- React (SPA) --> Use skill: workos-authkit-react
  |
  +-- React Router --> Use skill: workos-authkit-react-router
  |
  +-- Other --> Use skill: workos-authkit-vanilla-js
```

Each skill handles OAuth callbacks, session management, and UI components for that framework.

### Replace Cognito SDK Calls

**Common patterns:**

| Cognito Operation | WorkOS Equivalent |
|-------------------|-------------------|
| InitiateAuth | Check AuthKit skill for sign-in flow |
| GetUser | Check AuthKit skill for session/user retrieval |
| ForgotPassword | Use Password Reset API from Step 5 |
| ChangePassword | Check fetched docs for password update endpoint |
| AdminCreateUser | Use User Management API bulk import |

**Do NOT rewrite auth flows from scratch** — use AuthKit SDK patterns from related skills.

## Step 7: OAuth Provider Redirect URIs

For each OAuth provider configured in Step 3:

1. Access provider's developer console (Google, Facebook, etc.)
2. Find Redirect URI / Callback URL settings
3. **Add WorkOS redirect URI** (format: `https://api.workos.com/sso/oauth/callback`)
4. **Keep Cognito redirect URI active** during transition period

**Verification per provider:**
```bash
# Test OAuth flow completes without errors
# Check browser network tab for successful /callback response
```

Check [Google OAuth integration guide](https://workos.com/integrations/google-oauth) for provider-specific steps.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration readiness:

```bash
# 1. Verify WorkOS organization exists
curl -s -X GET "https://api.workos.com/organizations/<org-id>" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -e '.id' || echo "FAIL: Organization not found"

# 2. Verify at least one authentication method enabled
curl -s -X GET "https://api.workos.com/organizations/<org-id>" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq -e '.domains' || echo "FAIL: No auth methods"

# 3. Verify user import completed
curl -s -X GET "https://api.workos.com/user_management/users?organization_id=<org-id>" \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length' || echo "FAIL: No users imported"

# 4. Verify AuthKit integration builds
npm run build || echo "FAIL: Build errors"
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in import batch or user already migrated.

**Fix:**
- Use upsert pattern if API supports it (check fetched docs)
- Or: Query existing users first, filter duplicates from import batch

### OAuth provider shows "redirect_uri_mismatch"

**Cause:** WorkOS redirect URI not added to provider settings.

**Fix:**
1. Go to provider developer console
2. Add `https://api.workos.com/sso/oauth/callback` to allowed redirect URIs
3. Wait 5-10 minutes for DNS propagation
4. Retry OAuth flow

### Password reset emails not received

**Cause:** Email provider (SendGrid, etc.) not configured in WorkOS Dashboard, or emails in spam.

**Fix:**
- Check WorkOS Dashboard → Settings → Email Configuration
- Verify DNS records for custom email domain (SPF, DKIM)
- Check user's spam folder
- Use WorkOS test email endpoint to verify delivery (check fetched docs)

### Users report "invalid password" after migration

**Expected:** Cognito doesn't export password hashes. Users with password strategy "force reset" must reset passwords.

**Fix:**
- Verify Step 5 password reset emails sent successfully
- Provide clear UX messaging: "For security, please reset your password"
- Consider temporary "Contact Support" flow for users who can't access email

### Imported users missing attributes

**Cause:** Attribute mapping mismatch between Cognito and WorkOS schemas.

**Fix:**
- Check Cognito export includes all required attributes
- Verify WorkOS User Management API accepts custom attributes (check fetched docs)
- Re-import affected users with corrected mapping

### AuthKit session issues after Cognito replacement

**Cause:** Application still references Cognito tokens/sessions in localStorage or cookies.

**Fix:**
- Clear browser storage for all users (add localStorage.clear() on app load)
- Verify AuthKit provider wraps entire app (see related AuthKit skills)
- Check no lingering Cognito SDK imports remain in code

## Related Skills

- workos-authkit-nextjs — Next.js App Router integration
- workos-authkit-react — React SPA integration
- workos-authkit-react-router — React Router integration
- workos-authkit-vanilla-js — Framework-agnostic integration
