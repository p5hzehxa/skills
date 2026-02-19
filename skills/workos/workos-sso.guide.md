<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth for SSO implementation:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`

**Verify:** Both exist before proceeding. Missing keys will cause cryptic OAuth errors.

### SDK Installation

Confirm SDK package exists in project dependencies. Language-specific package name in fetched docs.

**Verify:** SDK package directory exists in node_modules/site-packages/vendor before importing.

## Step 3: Login Flow Decision Tree

SSO supports two initiation patterns. Choose based on UX requirements:

```
Who initiates auth?
  |
  +-- User starts from YOUR login page (enters email)
  |     --> Service Provider-Initiated (SP-initiated)
  |     --> Common pattern, implement this first
  |
  +-- User starts from THEIR IdP portal (clicks app icon)
        --> Identity Provider-Initiated (IdP-initiated)
        --> Often forgotten, causes support tickets if missing
```

**Critical:** Both flows must work for production SSO. Test IdP-initiated even if SP-initiated is primary UX.

### SP-Initiated Flow (User Enters Email)

1. User submits email on your login page
2. Your app determines organization from email domain or user input
3. Generate authorization URL with organization ID
4. Redirect user to authorization URL
5. IdP authenticates user
6. IdP redirects to your callback URL with `code`
7. Exchange `code` for user profile

**Trap:** Do NOT hardcode organization ID — use domain lookup or org selection UI.

### IdP-Initiated Flow (User Clicks App in IdP)

1. User logs into IdP directly
2. User selects your app from IdP app list
3. IdP redirects to your callback URL with `code` (no state parameter)
4. Exchange `code` for user profile
5. Create session and redirect to app

**Critical difference:** IdP-initiated flow skips authorization URL generation. Your callback MUST handle requests with no `state` parameter.

Check fetched docs for SDK methods to:
- Generate authorization URL (SP-initiated)
- Exchange code for profile (both flows)
- Handle missing state parameter (IdP-initiated)

## Step 4: Redirect URI Configuration

Your callback URL must be registered in WorkOS Dashboard before testing.

### Dashboard Setup

1. Navigate to Dashboard > Redirects
2. Add your callback URL exactly as deployed
3. URL must use HTTPS in production (localhost HTTP allowed for dev)

**Common trap:** Mismatched URLs (trailing slash, http vs https, subdomain) cause `redirect_uri_mismatch` errors.

### Callback Route Implementation

Create route at path matching registered redirect URI:

```
Registered URI           --> Route location
/auth/sso/callback       --> app/auth/sso/callback/route.ts (Next.js)
/sso/callback            --> routes/sso/callback.py (Django)
/callback                --> callback.php (Laravel)
```

Route must:
1. Extract `code` parameter from query string
2. Extract `error` and `error_description` if present (error case)
3. Exchange `code` for user profile using SDK
4. Create authenticated session
5. Redirect to authenticated landing page

**Critical:** Never log or expose `code` parameter — it's single-use and sensitive.

## Step 5: Organization Setup

SSO connections belong to organizations. Users authenticate via their organization's configured IdP.

### Organization-Connection Relationship

```
Organization (your customer company)
  └── SSO Connection (their IdP config)
      ├── Verified domain: example.com
      ├── IdP type: Okta, Azure AD, Google, etc.
      └── IdP metadata: entity ID, SSO URL, cert
```

**Critical:** One organization can have multiple domains, but each domain can only belong to one organization.

### Determine Organization (Decision Tree)

```
How to identify org from login email?
  |
  +-- Email domain is verified for an org (user@example.com, example.com is verified)
  |     --> Use domain-to-org lookup
  |     --> SDK method for domain lookup in fetched docs
  |
  +-- Email domain is NOT verified (freelancer, consultant, guest user)
  |     --> User must select organization from list
  |     --> OR: Reject with "contact your admin" message
  |
  +-- User's org allows multiple domains
        --> Email domain lookup works for any verified domain
        --> Guest domain testing scenario (see Step 6)
```

Check fetched docs for SDK method to look up organization by domain.

## Step 6: Testing Strategy

### Test Identity Provider (Built-in, Use This First)

WorkOS provides a staging Test IdP that simulates real SSO without external IdP setup.

**Advantage:** No Azure AD / Okta / Google Workspace account required for initial testing.

To use:
1. Login to Dashboard
2. Navigate to Test SSO page
3. Use provided test organization ID and test user credentials
4. Test both SP-initiated and IdP-initiated flows

**Test scenarios to verify:**

1. **SP-initiated with valid email** — user enters test email, redirects to Test IdP, authenticates, returns to app
2. **IdP-initiated** — start from Test IdP portal, select your app, redirects to callback without state
3. **Guest email domain** — email domain differs from organization's verified domain (tests guest user handling)
4. **Error response** — Test IdP simulates IdP error, callback receives `error=access_denied`

**Verification command:**

```bash
# After callback processes code, user session should exist
# Replace with your session check command
curl -b cookies.txt https://localhost:3000/api/user | grep authenticated
```

### Real Identity Provider Testing (Optional, for IdP-specific behavior)

If Test IdP passes but you need to verify specific IdP behavior:

1. Create organization in Dashboard
2. Invite admin to organization with "Single Sign-On" feature
3. Copy setup link from invitation
4. Follow Admin Portal instructions for target IdP (Okta, Azure AD, etc.)
5. Complete IdP configuration using Admin Portal's step-by-step guide
6. Test both login flows with real IdP credentials

**When to use real IdP testing:**
- Customer reports IdP-specific issue
- Testing attribute mapping for specific IdP
- Verifying SAML signing certificate handling

Check fetched docs for complete Admin Portal integration guide.

## Step 7: Error Handling (CRITICAL)

Callback route MUST handle error responses from IdP. User is redirected to callback with `error` and `error_description` query parameters.

### Error Parameter Pattern

```
https://your-app.com/callback?error=access_denied&error_description=User%20cancelled&state=xyz
```

### Error Code Decision Tree

```
error parameter?
  |
  +-- "access_denied" --> User cancelled at IdP, show "Sign-in cancelled" message
  |
  +-- "signin_consent_denied" --> User rejected sign-in consent prompt
  |                               (IdP asked "Allow YourApp to access profile?", user said no)
  |                               --> Show: "Contact your admin if this was unexpected"
  |                               --> Possible phishing attempt - user didn't recognize your app
  |
  +-- Other error codes --> Check fetched docs for complete error code table
```

**Critical for consent denial:** User explicitly rejected your app at IdP. This may indicate:
- User doesn't recognize your app name (branding mismatch)
- Possible phishing attempt
- Admin needs to pre-approve app in IdP

Display actionable message with support contact, not generic "authentication failed".

Check fetched docs for complete error code reference.

## Step 8: Single Logout (Optional)

Standard logout clears session in YOUR app only. Single Logout (SLO) clears session in YOUR app AND the IdP.

**Important limitations (as of latest docs):**
- Only supported for OpenID Connect (OIDC) connections
- NOT supported for SAML connections yet
- Limited IdP support even for OIDC

**Decision:** Implement SLO or not?

```
Do you need SLO?
  |
  +-- Users share devices (kiosks, public terminals)
  |     --> YES, implement SLO to prevent session hijacking
  |
  +-- Users only access via personal devices
  |     --> MAYBE, consider UX trade-off (logs user out of all SSO apps)
  |
  +-- Connections are SAML-based
        --> NO, SLO not supported for SAML (as of current docs)
```

If implementing SLO, redirect user to Logout Redirect endpoint after clearing local session. Check fetched docs for:
- OIDC connection requirements
- Logout Redirect endpoint URL
- Post-logout redirect URI configuration

**Note:** If SLO is critical and connections are SAML, contact WorkOS support for roadmap.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking integration complete:

```bash
# 1. Environment variables exist
grep -q "WORKOS_API_KEY=sk_" .env && echo "PASS: API key" || echo "FAIL: API key missing or wrong prefix"
grep -q "WORKOS_CLIENT_ID=client_" .env && echo "PASS: Client ID" || echo "FAIL: Client ID missing or wrong prefix"

# 2. Callback route exists (adjust path to your framework)
test -f app/auth/callback/route.ts && echo "PASS: Callback route" || echo "FAIL: Callback route missing"

# 3. Test organization exists in Dashboard
# Manual check: Dashboard > Organizations > count > 0

# 4. Redirect URI registered in Dashboard
# Manual check: Dashboard > Redirects > contains your callback URL

# 5. SP-initiated flow works (replace with your test URL)
curl -I "http://localhost:3000/login" | grep -q "302\|301" && echo "PASS: Login redirects" || echo "FAIL: Login broken"

# 6. Error handling exists in callback
grep -q "error.*error_description" app/auth/callback/route.ts && echo "PASS: Error handling" || echo "FAIL: No error handling"
```

**Manual test checklist:**

- [ ] Test IdP SP-initiated flow completes successfully
- [ ] Test IdP IdP-initiated flow completes successfully (start from Test IdP portal)
- [ ] Guest email domain test works (email domain ≠ verified domain)
- [ ] Error response shows user-friendly message (not stack trace)
- [ ] `signin_consent_denied` error shows specific guidance (not generic error)

## Error Recovery

### "redirect_uri_mismatch"

**Cause:** Callback URL in code doesn't match registered redirect URI in Dashboard.

**Fix:**
1. Check registered URIs: Dashboard > Redirects
2. Compare with callback URL used in authorization URL generation
3. Look for: trailing slash, http vs https, subdomain differences
4. Update Dashboard to match code OR update code to match Dashboard
5. Redeploy if production URL changed

### "invalid_grant" or "code already used"

**Cause:** Authorization code expired or reused (codes are single-use, 10-minute expiration).

**Common scenarios:**
- User clicked back button after callback
- Callback route ran twice (duplicate request)
- Code exchange took > 10 minutes (network issue)

**Fix:**
1. Redirect user back to login page to generate fresh authorization URL
2. Add idempotency check in callback (track processed codes)
3. Ensure callback route doesn't execute twice on same request

### "Organization not found" or "Domain not found"

**Cause:** Email domain not associated with any organization, or organization lookup failed.

**Fix:**
1. Check Dashboard: Organizations > domain is listed under verified domains
2. If user is guest (email domain ≠ company domain): Implement org selection UI instead of domain lookup
3. If domain should work: Verify API key environment matches Dashboard environment (staging vs prod)

### IdP-initiated flow fails with "state parameter missing"

**Cause:** Callback expects `state` parameter for CSRF validation, but IdP-initiated flow doesn't include it.

**Fix:**
1. Make `state` validation conditional: if `state` is present, validate it; if absent, allow (IdP-initiated)
2. Check SDK documentation for IdP-initiated flag or alternative validation method
3. Never skip validation entirely — use alternative CSRF protection for IdP-initiated requests

### "signin_consent_denied" — User rejects app at IdP

**Cause:** IdP prompted "Allow [YourApp] to access your profile?" and user clicked "Deny".

**Why this happens:**
- User doesn't recognize your app name at IdP (branding mismatch)
- Possible phishing attempt (user got suspicious)
- Admin needs to pre-consent app for all users in IdP

**Fix:**
1. Display specific message: "You rejected sign-in consent. If this was unexpected, contact your admin or [support email]."
2. Check IdP configuration: Does app name match your brand?
3. For enterprise customers: Ask admin to enable admin consent (pre-approve app) in IdP settings

### Connection test fails but Test IdP works

**Cause:** Real IdP configuration issue (metadata incorrect, cert expired, URL mismatch).

**Fix:**
1. Check Dashboard > Organizations > [org] > Connections > [connection] for warning icons
2. Verify IdP metadata matches connection settings: Entity ID, SSO URL, signing certificate
3. Use Admin Portal to re-verify connection setup steps
4. Check IdP's audit logs for failed authentication attempts (may show root cause)
5. Contact WorkOS support with connection ID if issue persists

**Common real IdP issues:**
- SAML signing certificate expired (IdP rotated cert, WorkOS has old one)
- ACS URL in IdP doesn't match WorkOS's expected URL
- IdP requires specific NameID format not configured in connection

## Related Skills

For complete authentication systems with SSO:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
