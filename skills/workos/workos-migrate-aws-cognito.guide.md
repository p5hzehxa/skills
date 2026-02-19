<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/aws-cognito`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Audit

### Cognito User Pool Analysis

Identify what you're migrating:

```
User authentication types?
  |
  +-- Username/password only --> Step 3 (User Export)
  |
  +-- OAuth providers (Google, etc.) --> Step 4 (OAuth Migration)
  |
  +-- Both --> Complete Steps 3 AND 4
```

### Critical Cognito Limitation

**AWS Cognito does NOT export password hashes.** This is a Cognito platform limitation, not a WorkOS limitation.

Impact: All username/password users must reset passwords after migration.

WorkOS DOES support importing password hashes from systems that export them (e.g., Auth0, Okta). The constraint here is Cognito's export functionality.

## Step 3: Username/Password User Migration

### Export Users from Cognito

Check fetched docs for Cognito export procedure. Key fields to capture:

- User email (primary identifier)
- User metadata (name, phone, custom attributes)
- Account status (confirmed, unconfirmed)

**Do NOT expect password hashes** — Cognito doesn't provide them.

### Import Users to WorkOS

Use the WorkOS SDK method for user creation. Check fetched docs for exact API.

Pattern:

```
For each Cognito user:
  1. Create WorkOS user with email
  2. Map Cognito attributes to WorkOS user profile
  3. Mark account as "requires password reset"
```

**Verification command:**

```bash
# Confirm user count matches
echo "Cognito users: $(aws cognito-idp list-users --user-pool-id YOUR_POOL_ID --query 'Users' | jq length)"
# Compare with WorkOS Dashboard user count
```

## Step 4: Password Reset Strategy (REQUIRED)

Since Cognito doesn't export password hashes, choose one:

### Option A: Forced Reset on Next Login

- Detect user's first WorkOS login attempt
- Redirect to password reset flow
- Use WorkOS Send Password Reset Email API (check fetched docs for endpoint)

### Option B: Proactive Reset Emails

- After user import completes
- Batch send password reset emails via WorkOS API
- Set expiration window (24-48 hours recommended)

**Verification command:**

```bash
# Test password reset flow for one user
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Expected: 201 response with reset link.

## Step 5: OAuth Provider Migration

### Credential Preservation (CRITICAL)

For each OAuth connection (Google, Facebook, etc.) in Cognito:

1. Note the Client ID and Client Secret used in Cognito
2. Configure WorkOS connection with THE SAME credentials
3. Do NOT generate new OAuth app credentials

**Why:** Preserves user consent. If credentials change, users must re-authorize.

### Redirect URI Update

WorkOS uses different callback URLs than Cognito. In each OAuth provider's dashboard:

1. Locate "Authorized Redirect URIs" or equivalent
2. ADD WorkOS redirect URI (check fetched docs for format)
3. DO NOT remove Cognito URI until migration complete

**Pattern for Google OAuth:**

- Cognito URI: `https://your-domain.auth.region.amazoncognito.com/oauth2/idpresponse`
- WorkOS URI: Check fetched docs for WorkOS callback format
- Keep BOTH active during migration

**Trap:** If you remove old URI before cutover, existing user sessions break.

### Testing OAuth Flow

```bash
# 1. Initiate WorkOS OAuth (use SDK method for authorization URL)
# 2. Complete OAuth flow in browser
# 3. Verify user lands in your app with valid session
# 4. Check WorkOS Dashboard for successful OAuth connection event
```

## Step 6: Metadata Migration

Map Cognito custom attributes to WorkOS user profile:

```
Cognito Attribute          --> WorkOS Field
custom:company_id          --> Check fetched docs for custom field syntax
custom:role                --> Map to WorkOS role system if using RBAC
email_verified             --> WorkOS email verification status
```

Check fetched docs for WorkOS user profile schema and custom attribute support.

## Step 7: Cutover Planning

### Pre-Cutover Checklist

- [ ] All users imported to WorkOS (verify counts match)
- [ ] OAuth redirect URIs updated in all providers
- [ ] Password reset strategy tested with sample users
- [ ] Application code updated to WorkOS SDK (if migrating from Cognito SDK)
- [ ] Rollback plan documented

### During Cutover

1. Enable WorkOS authentication in application
2. Disable Cognito authentication
3. Monitor error logs for failed login attempts
4. Be ready to rollback if OAuth flows fail

### Post-Cutover

- [ ] Remove Cognito redirect URIs from OAuth providers (after 24-48 hours)
- [ ] Archive Cognito user pool (do not delete immediately)
- [ ] Monitor password reset volume

## Verification Checklist (ALL MUST PASS)

```bash
# 1. User count matches
# (Compare Cognito export with WorkOS Dashboard manually)

# 2. Password reset flow works
curl -X POST https://api.workos.com/user_management/password_reset \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_TEST_USER@example.com"}' \
  | grep -q "email" && echo "PASS" || echo "FAIL"

# 3. OAuth connection configured
# (Check WorkOS Dashboard for OAuth connection status - should be "Active")

# 4. Application builds with WorkOS SDK
npm run build && echo "PASS" || echo "FAIL"
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email or retry without idempotency check.

Fix:

1. Check if user email already in WorkOS Dashboard
2. If exists with correct data, skip
3. If exists with wrong data, use SDK update method instead of create

### OAuth callback "redirect_uri_mismatch"

**Cause:** WorkOS URI not added to OAuth provider's allowed list.

Fix:

1. Go to OAuth provider dashboard (Google Cloud Console, etc.)
2. Find "Authorized redirect URIs"
3. Add WorkOS URI from fetched docs
4. Wait 5 minutes for propagation
5. Retry OAuth flow

### Password reset email not received

**Cause:** Email provider blocking, or invalid "from" address in WorkOS.

Fix:

1. Check WorkOS Dashboard email configuration
2. Verify "from" address domain has SPF/DKIM records
3. Test with personal email first (Gmail/Yahoo less likely to block)
4. Check spam folder

### Users can't log in after migration

**Decision tree:**

```
Login failure?
  |
  +-- "Invalid credentials" --> Expected if password reset not done
  |                             (Cognito didn't export hashes)
  |
  +-- "User not found" --> Import didn't complete
  |                        Check WorkOS Dashboard for user
  |
  +-- OAuth error --> Check OAuth provider redirect URI config
```

### High password reset volume overwhelming support

**Cause:** No proactive reset communication before cutover.

Fix:

1. Send batch password reset emails BEFORE enabling WorkOS auth
2. Include clear instructions and support contact
3. Set longer expiration window (48+ hours)
4. Monitor reset completion rate daily

## Related Skills

- workos-authkit-nextjs - If migrating to Next.js App Router
- workos-authkit-react - If migrating to React SPA
