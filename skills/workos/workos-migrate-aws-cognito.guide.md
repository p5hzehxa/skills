<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Source System Limitations (Cognito)

**Critical distinction:** The password hash limitation is on COGNITO'S export side, not WorkOS's import side.

- **Cognito does NOT export password hashes** — you cannot extract existing password hashes from Cognito user pools
- WorkOS CAN import password hashes, but Cognito doesn't provide them
- **Implication:** All migrated users will need password resets

Check fetched docs for: whether AWS has changed Cognito's export capabilities since this skill was written.

### WorkOS Setup

Verify in WorkOS Dashboard:

- [ ] Organization created (will hold migrated users)
- [ ] Connection configured (email/password or OAuth provider)
- [ ] API keys available (`WORKOS_API_KEY` starts with `sk_`, `WORKOS_CLIENT_ID` starts with `client_`)

## Step 3: Migration Strategy Decision Tree

```
User Authentication Method?
  |
  +-- Email/Password (MOST COMMON)
  |     |
  |     +-- Cognito does not export password hashes
  |     |
  |     +-- Options:
  |           1. Bulk import users → trigger password resets (RECOMMENDED)
  |           2. Just-in-time migration during login (requires Cognito API access)
  |
  +-- OAuth Providers (Google, Microsoft, etc.)
        |
        +-- Reuse same OAuth credentials in WorkOS
        |
        +-- Add WorkOS redirect URIs to OAuth provider (see Step 5)
```

**Decision factor:** Do you need to preserve Cognito access during migration (gradual cutover) or can you do a hard cutoff?

- **Hard cutoff:** Bulk import + password reset emails
- **Gradual cutover:** Just-in-time migration (requires custom auth flow)

Check fetched docs for: code examples of just-in-time migration pattern.

## Step 4: User Export from Cognito

Export user data from Cognito User Pool:

```bash
# Using AWS CLI
aws cognito-idp list-users --user-pool-id <pool-id> > users.json
```

**What you'll get:**

- User email addresses
- User metadata (name, profile fields)
- OAuth provider connections (if applicable)

**What you WON'T get:**

- Password hashes (Cognito limitation)
- MFA secrets (re-enrollment required)

Parse exported data into format for WorkOS User Management API. Check fetched docs for: required user object schema.

## Step 5: Import Users to WorkOS

Use User Management API to create users. Check fetched docs for: exact endpoint and request schema.

**Pattern (pseudocode):**

```
for each user in cognito_export:
  create_workos_user({
    email: user.email,
    first_name: user.given_name,
    last_name: user.family_name,
    email_verified: user.email_verified
  })
```

**Verification command after import:**

```bash
# Check user count matches
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?organization_id=<org_id>&limit=1" \
  | jq '.list_metadata.total'
```

Expected: total matches your Cognito user count.

## Step 6: OAuth Provider Migration (if applicable)

**CRITICAL:** If users authenticate via Google, Microsoft, etc., you must preserve their OAuth connections.

### For Each OAuth Provider in Cognito

1. **Extract credentials from Cognito:**
   - Client ID
   - Client Secret

2. **Create connection in WorkOS:**
   - Use SAME credentials as Cognito connection
   - Check fetched docs for: connection creation endpoint

3. **Add WorkOS redirect URI to OAuth provider:**

   **Example for Google:**
   - Go to Google Cloud Console → OAuth 2.0 Client IDs
   - Add redirect URI: `https://api.workos.com/sso/oauth/google/callback`
   - Check fetched docs for: exact redirect URI format (may vary by provider)

**Verification:** Test OAuth login flow for each provider before cutover.

## Step 7: Trigger Password Resets

**CRITICAL:** All email/password users MUST reset passwords (Cognito didn't export hashes).

### Bulk Password Reset Strategy

**Option A: Proactive (RECOMMENDED)**

Send password reset emails immediately after import:

```
for each migrated_user:
  send_password_reset_email({
    email: user.email,
    organization_id: workos_org_id
  })
```

Check fetched docs for: exact endpoint and parameters for password reset API.

**Option B: Just-in-time**

Trigger reset on first login attempt:

- Detect migrated user has no password hash
- Return error → redirect to password reset flow
- Check fetched docs for: how to detect "no password set" condition

**Verification command:**

```bash
# Check password reset emails sent (via WorkOS Dashboard)
# Look for spike in "password_reset_requested" events
```

## Step 8: AuthKit Integration (REQUIRED)

**You MUST integrate AuthKit to handle authentication UI.** Cognito's hosted UI no longer applies.

Choose integration path based on your stack:

```
Framework?
  |
  +-- Next.js App Router --> Use skill: workos-authkit-nextjs
  |
  +-- React (CSR)        --> Use skill: workos-authkit-react
  |
  +-- Other              --> Use skill: workos-authkit-base
```

**Each AuthKit skill will handle:**

- Login/signup UI
- Session management
- OAuth provider buttons (if you migrated OAuth connections)

**Do NOT** attempt to implement custom auth UI. AuthKit is required for WorkOS authentication.

## Step 9: Cutover Validation

Run these checks BEFORE switching DNS/traffic:

```bash
# 1. User count matches
echo "Cognito users: $(jq '. | length' users.json)"
echo "WorkOS users: $(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?organization_id=<org_id>" \
  | jq '.data | length')"

# 2. OAuth providers configured
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organizations/<org_id>/connections" \
  | jq '.data[].connection_type'
# Expected: ["GoogleOAuth", ...] matching Cognito providers

# 3. AuthKit integration deployed
curl -s https://yourdomain.com/auth/callback
# Expected: 200 or redirect (not 404)

# 4. Test login for sample user
# Manual: attempt login with known test user credentials
```

**All checks must pass before cutover.**

## Verification Checklist (ALL MUST PASS)

- [ ] User export from Cognito complete (users.json exists)
- [ ] All users imported to WorkOS (count matches via API check)
- [ ] OAuth connections migrated (if applicable)
- [ ] Password reset emails sent (for email/password users)
- [ ] AuthKit integrated and deployed
- [ ] Test login succeeds for sample users
- [ ] Cognito User Pool can be safely deactivated

## Error Recovery

### "User not found" after migration

**Root cause:** User import failed or used wrong organization ID.

Fix:

1. Check organization ID in import script matches Dashboard
2. Re-run import for missing users
3. Verify via API: `GET /user_management/users?email=<email>`

### OAuth login fails with "invalid_client"

**Root cause:** OAuth credentials mismatch or missing redirect URI.

Fix:

1. **Check credentials match Cognito exactly** (Client ID and Secret)
2. Verify WorkOS redirect URI added to OAuth provider console
3. Check fetched docs for: provider-specific redirect URI format

### Password reset emails not received

**Root cause:** Email not verified in WorkOS or rate limit hit.

Fix:

1. Check user `email_verified` field: `GET /user_management/users/<user_id>`
2. Check WorkOS Dashboard for email delivery failures
3. If rate limited, wait and retry (check fetched docs for rate limits)

### "Cannot use Cognito credentials after migration"

**Expected behavior:** Cognito passwords do NOT transfer. This is a Cognito limitation, not a WorkOS limitation.

Fix:

- Users MUST reset passwords via WorkOS password reset flow
- Send clear communication to users about password reset requirement

### MFA not working after migration

**Root cause:** MFA secrets cannot be exported from Cognito.

Fix:

- Users must re-enroll in MFA after migration
- Check fetched docs for: WorkOS MFA enrollment API

## Related Skills

- workos-authkit-nextjs (if using Next.js)
- workos-authkit-react (if using React)
- workos-authkit-base (for other frameworks)
