<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### System Audit

Map your current standalone SSO API usage:

```
For each SSO integration point:
  |
  +-- Initiation (Get Authorization URL)?
  |   └── Location: _____________
  |
  +-- Callback (exchange code for profile)?
  |   └── Location: _____________
  |
  +-- Profile ID storage?
      └── Database schema: _____________
```

**Critical:** Document every place you store Profile IDs — these will become invalid after migration.

### Environment Variables

Check that these exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Do not proceed** if either is missing.

## Step 3: User ID Migration Strategy (Decision Tree)

AuthKit returns User objects with **different IDs** than standalone SSO API Profile objects.

```
How do you identify users?
  |
  +-- By Profile ID only
  |   └── RISK: High — requires database migration before launch
  |       Action: Plan ID remapping strategy (see Step 4)
  |
  +-- By email (unique constraint)
  |   └── SAFE: Use email to match existing users
  |       Note: WorkOS verifies emails before completing auth
  |
  +-- By external ID (from identity provider)
      └── VERIFY: Check if external ID persists in User object
          (WebFetch docs to confirm field mapping)
```

**Trap:** If you skip ID migration planning, existing user sessions will break on first AuthKit login.

## Step 4: ID Remapping Strategy (if Profile ID is primary key)

### Option A: Dual-ID Transition Period

1. Add `workos_user_id` column to user table (nullable)
2. On first AuthKit login: match by email, store new User ID
3. Update application logic to check both IDs
4. After all users migrated: drop old Profile ID column

### Option B: Pre-Migration ID Mapping

Use WorkOS API to fetch all existing Profiles, create mapping table:

```
profile_migrations
  - old_profile_id (from standalone SSO API)
  - workos_user_id (from AuthKit)
  - matched_by (email/external_id)
  - migrated_at
```

**Verification:** Query unmigrated users before launch: `SELECT COUNT(*) WHERE workos_user_id IS NULL`

## Step 5: Replace SSO Initiation

### Current Code Pattern (Standalone SSO API)

```
Initiate SSO:
  → Call: Get Authorization URL (SSO API)
  → Parameters: provider, connection, organization, redirect_uri, state
  → Returns: authorization_url
  → Action: Redirect user to authorization_url
```

### New Code Pattern (AuthKit)

```
Initiate AuthKit:
  → Call: Get Authorization URL (AuthKit API)
  → Parameters: Same as above, PLUS new option: provider="authkit"
  → Returns: authorization_url
  → Action: Redirect user to authorization_url
```

**Key difference:** AuthKit API accepts `provider="authkit"` for hosted UI. For direct SSO connections, use existing provider values (Google, Okta, etc.).

**Check fetched docs for:** Exact API endpoint path and parameter schema.

### Decision: Hosted UI vs Direct SSO

```
Migration path?
  |
  +-- Keep existing SSO-only flow
  |   └── Use provider-specific values (Google, Okta, etc.)
  |       AuthKit API is backward-compatible
  |
  +-- Add password/magic link auth
      └── Use provider="authkit" for hosted UI
          Requires: AuthKit configuration in Dashboard
```

## Step 6: Replace Callback Handler

### Current Code Pattern (Standalone SSO API)

```
Callback receives: code, state
  |
  +-- Exchange code for Profile
  |   Call: Get Profile and Token (SSO API)
  |   Receives: Profile object with profile_id
  |
  +-- Create/update user session
      Store: profile_id in session/database
```

### New Code Pattern (AuthKit)

```
Callback receives: code, state (SAME)
  |
  +-- Exchange code for User
  |   Call: Authenticate (AuthKit API)
  |   Parameters: grant_type="authorization_code", code
  |   Receives: User object with id (NOT profile_id)
  |
  +-- Handle new response types (IMPORTANT)
  |   Success → User object
  |   Error → email_verification_required | mfa_enrollment | ...
  |
  +-- Create/update user session
      IF using email matching:
        1. Look up user by User.email
        2. Update workos_user_id if needed
      ELSE:
        Store User.id directly
```

**Trap:** AuthKit returns **errors for security flows** (email verification, MFA) that standalone SSO API auto-handled. See Step 7.

**Check fetched docs for:** Complete list of new error types and response schemas.

## Step 7: Handle New Authentication Flows (CRITICAL)

AuthKit enforces security features that may interrupt the callback flow.

```
Authenticate API response?
  |
  +-- Success (200)
  |   └── User object returned
  |       Proceed to session creation
  |
  +-- email_verification_required
  |   └── User must verify email before completing auth
  |       IF using AuthKit Hosted UI: Handled automatically
  |       IF using API directly: Display verification pending UI
  |
  +-- mfa_enrollment (if MFA required)
  |   └── User must enroll in MFA
  |       IF using AuthKit Hosted UI: Handled automatically
  |       IF using API directly: Redirect to MFA enrollment
  |
  +-- pending_authentication
      └── MFA challenge in progress
          Wait for user to complete challenge
```

**Decision:** Disable features in Dashboard OR handle errors in code.

### Dashboard Configuration Options

Navigate to: WorkOS Dashboard → Authentication

**If you want standalone SSO API behavior** (no interruptions):
- Disable "Require Email Verification"
- Disable "Require MFA"
- Set "Account Linking" to "Auto-link by email"

**If you want enhanced security:**
- Keep features enabled
- Use AuthKit Hosted UI (handles flows automatically), OR
- Implement error handling for each flow type

**Trap:** If you disable features in Dashboard, migration is backward-compatible. If you enable them WITHOUT handling errors, auth will break.

## Step 8: AuthKit Hosted UI (Optional)

If you want password auth, magic links, or automatic security flow handling:

### Enable AuthKit in Dashboard

1. Navigate to: WorkOS Dashboard → AuthKit
2. Configure branding (logo, colors)
3. Set custom domain (optional)
4. Note redirect URI for your environment

### Update Initiation Code

Change provider parameter:

```
From: provider="google" | "okta" | connection="conn_..."
To:   provider="authkit"
```

This redirects users to WorkOS-hosted UI instead of directly to IdP.

**Verification:** Test login — should see WorkOS-branded UI, not direct IdP redirect.

**Check fetched docs for:** AuthKit configuration options and branding customization.

## Step 9: Framework-Specific Integration

For framework SDKs (Next.js, React, etc.), use the AuthKit SDK instead of migrating API calls manually.

```
Framework?
  |
  +-- Next.js (App Router 13+)
  |   └── Use: workos-authkit-nextjs skill
  |       Handles: Middleware, callbacks, session management
  |
  +-- React SPA
  |   └── Use: workos-authkit-react skill
  |       Handles: useAuth() hook, protected routes
  |
  +-- Vanilla JS
  |   └── Use: workos-authkit-vanilla-js skill
  |       Handles: Fetch wrappers, token refresh
  |
  +-- Other / API-only
      └── Follow Steps 5-7 (manual API integration)
```

**Do NOT mix:** Framework SDKs with manual API calls — pick one approach.

## Verification Checklist (ALL MUST PASS)

Run these checks in order. **Do not mark complete until all pass:**

```bash
# 1. Verify AuthKit API is reachable
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'$WORKOS_CLIENT_ID'","grant_type":"authorization_code","code":"invalid"}' \
  | grep -q "invalid_grant" && echo "PASS: API reachable" || echo "FAIL: Check API key"

# 2. Check for Profile ID references in codebase
grep -r "profile_id\|ProfileID" . --exclude-dir=node_modules | wc -l
# If count > 0: Verify ID migration strategy from Step 4 is implemented

# 3. Check for standalone SSO API endpoints (should be replaced)
grep -r "sso/authorize\|sso/profile" . --exclude-dir=node_modules
# Should return NO matches after migration

# 4. Test auth flow end-to-end
# Start login → Complete at IdP → Verify callback receives User object (not Profile)
```

**If check #2 returns hits:** Review each occurrence — update to use User.id or email matching.

**If check #3 returns hits:** Incomplete migration — go back to Steps 5-6.

## Error Recovery

### "Invalid user ID" on existing user login

**Root cause:** Application looking up user by old Profile ID.

Fix:
1. Check ID migration strategy (Step 3)
2. If using email matching: Ensure lookup by `User.email` before `User.id`
3. If using dual-ID: Ensure fallback to old Profile ID until migration complete

### "Email verification required" blocks login

**Root cause:** Email verification enabled in Dashboard, but callback doesn't handle error.

Fix options:
1. **Easiest:** Disable email verification in Dashboard (WorkOS → Authentication)
2. **Recommended:** Switch to AuthKit Hosted UI (handles automatically)
3. **Advanced:** Implement error handler for `email_verification_required` response

**Check fetched docs for:** Email verification error response schema.

### "User not found" for existing SSO users

**Root cause:** Email not matching OR external ID lost in migration.

Fix:
1. Check User object fields: verify `email` matches Profile `email` exactly
2. If using external ID: WebFetch docs to confirm field name in User object
3. Test with known SSO user: compare Profile vs User response side-by-side

### AuthKit Authenticate returns 401

**Root cause:** Invalid client ID or API key.

Fix:
1. Verify `WORKOS_CLIENT_ID` starts with `client_`
2. Verify `WORKOS_API_KEY` starts with `sk_` and belongs to same environment
3. Check Dashboard: API key has "User Management" permissions

### Redirect loop after callback

**Root cause:** Callback handler not setting session correctly, re-initiating auth.

Fix:
1. Verify callback stores User ID in session (not Profile ID)
2. Check session middleware: ensure it recognizes new User ID format
3. Test: Log session contents immediately after callback — should contain `workos_user_id`

## Related Skills

- workos-authkit-nextjs - Next.js App Router (13+) integration
- workos-authkit-react - React SPA with protected routes
- workos-authkit-vanilla-js - Vanilla JavaScript implementation
