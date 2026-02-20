<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

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

Check for these variables:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`
- Redirect URI configured (callback URL where users return after SSO)

### WorkOS Dashboard Access

Confirm you can access:

- Organizations page (for creating test orgs)
- SSO Connections page (for viewing connections)
- API Keys page (for verifying credentials)

## Step 3: Choose Login Flow (Decision Tree)

SSO supports two distinct flows. Choose based on where users START authentication:

```
Where does the user click "Sign In"?
  |
  +-- Your app's login page
  |     --> Service Provider-Initiated (SP-initiated)
  |     --> User enters email → app redirects to IdP
  |     --> Most common for new integrations
  |
  +-- Identity Provider dashboard
        --> Identity Provider-Initiated (IdP-initiated)
        --> User selects your app from IdP app list
        --> MUST handle unsolicited assertions
        --> Often forgotten — test this explicitly
```

**Both flows must work.** Test IdP-initiated flow even if you think users won't use it — IT admins enable it by default.

## Step 4: Test with Test Identity Provider

### Access Test SSO Page

Dashboard → _Test SSO_ page provides:

- Pre-configured test organization (domain: `example.com`)
- Active SSO connection using Test IdP
- Test scenarios with exact parameters

### Test Scenarios (ALL MUST PASS)

**Scenario 1: SP-Initiated Flow**

- User enters email in your app
- App calls SDK authorization URL method with `email` parameter
- User redirects to Test IdP → authenticates → returns to callback

**Scenario 2: IdP-Initiated Flow**

- Start from Test IdP page in dashboard (NOT your app)
- Click "Initiate SSO"
- User lands directly at your callback with `code` parameter
- **Critical:** Verify your callback handles requests WITHOUT `state` parameter

**Scenario 3: Guest Email Domain**

- Use email with domain OTHER than `example.com`
- Test org must have guest domain support enabled
- Confirms handling of freelancers/contractors with external emails

**Scenario 4: Error Response**

- Trigger error scenario from Test SSO page
- Callback receives `error` and `error_description` parameters instead of `code`
- Verify your app displays error to user (don't crash)

## Step 5: Implementation Pattern

### Authorization URL Generation

When user enters email or selects SSO:

```
// Generate authorization URL for user
authorizationUrl = workos.sso.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: YOUR_CALLBACK_URL,
  state: GENERATE_RANDOM_STATE,  // CSRF protection

  // ONE of these (decision tree):
  organization: org_id,     // If you know which org
  organizationId: org_id,   // Alternative parameter name
  provider: 'GoogleOAuth',  // If using OAuth provider directly
  connection: conn_id,      // If targeting specific connection
  domainHint: 'example.com' // If identifying by email domain
})

// Store state in session for verification
// Redirect user to authorizationUrl
```

**Choosing the identifier (decision tree):**

```
How do you identify which SSO connection?
  |
  +-- Multi-tenant app with org selection
  |     --> Use organization parameter
  |
  +-- Email domain matching (user enters email)
  |     --> Use domainHint parameter
  |     --> WorkOS matches domain to organization
  |
  +-- Direct OAuth provider (Google, Microsoft)
  |     --> Use provider parameter
  |
  +-- Specific connection known
        --> Use connection parameter
```

Check fetched docs for exact parameter names and supported providers.

### Callback Handler

Handle redirect at your callback URL:

```
// Extract parameters from callback URL
code = request.query.code
state = request.query.state
error = request.query.error

// CRITICAL: Verify state matches session
if state != stored_state:
  return error("Invalid state - possible CSRF")

// Error handling (user or IdP error)
if error:
  if error == "signin_consent_denied":
    return "You declined sign-in. Contact your admin if this was unexpected."
  else:
    return "Authentication failed: " + error_description

// Exchange code for profile
profile = workos.sso.getProfileAndToken({
  code: code,
  clientId: WORKOS_CLIENT_ID
})

// Create session with profile data
session.user = {
  id: profile.id,
  email: profile.email,
  firstName: profile.firstName,
  lastName: profile.lastName,
  organizationId: profile.organizationId,
  connectionId: profile.connectionId
}
```

**Critical checks:**

- Always verify `state` parameter (CSRF protection)
- Handle `error` parameter before attempting code exchange
- IdP-initiated flow may not include `state` — check if it's optional in your session validation
- Never expose raw error messages to users (log them server-side)

## Step 6: Testing with Real Identity Providers (Optional)

If you need to test with a real IdP (Okta, Azure AD, Google, etc.):

### Create Test Organization

Dashboard → Organizations → Create organization → enter customer company name

### Send Setup Link

Organization page → _Invite admin_ → Select _Single Sign-On_ → enter email or copy link

**Two integration paths:**

```
How will customers set up SSO?
  |
  +-- Self-serve
  |     --> Integrate Admin Portal into your app
  |     --> Customers follow guided setup
  |
  +-- Support-assisted
        --> Send setup link via email
        --> Walk customer through Admin Portal steps
```

### Complete IdP Configuration

Follow Admin Portal instructions for chosen IdP. You'll need:

- IdP account (Okta, Azure AD, etc.)
- Admin access to create applications
- Ability to configure SAML/OIDC settings

Check fetched docs for provider-specific setup guides.

## Step 7: Single Logout (Optional)

**Supported for OpenID Connect connections only.** SAML support is limited — contact WorkOS support if needed.

### RP-Initiated Logout

Logs user out of your app AND all other apps via the IdP:

```
// Redirect user to logout endpoint
logoutUrl = workos.sso.getLogoutUrl({
  sessionId: session.id  // From profile after authentication
})

// Clear local session
session.destroy()

// Redirect to logoutUrl
```

User will be logged out globally across all SSO-enabled apps.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Environment variables are set
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ API key valid"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ Client ID valid"

# 2. Dashboard has test organization
# Manual: Go to dashboard.workos.com/organizations
# Confirm "Test Organization" exists with domain example.com

# 3. Test scenarios pass (run from your app)
# - SP-initiated: Enter email → redirects to IdP → returns with code
# - IdP-initiated: Start from Test IdP page → lands at callback with code
# - Guest domain: Use non-example.com email → succeeds
# - Error handling: Trigger error → displays user-friendly message

# 4. Callback handles both flows
curl "http://localhost:3000/callback?code=test&state=123"  # SP-initiated
curl "http://localhost:3000/callback?code=test"           # IdP-initiated (no state)

# 5. State validation works
# Try callback with mismatched state → should reject
```

**Manual verification:**

- Test SSO page in dashboard shows all scenarios green
- Error responses show user-friendly messages (not stack traces)
- IdP-initiated flow works WITHOUT user starting from your app

## Error Recovery

### "Invalid state" or "State mismatch"

**Root cause:** CSRF protection detecting mismatched state parameter.

**Fixes:**

- Verify state is stored in session BEFORE redirect
- Check session persists across redirect (cookie settings)
- Confirm state comparison is string equality (not object comparison)
- For IdP-initiated flow: state may be absent — make validation conditional

### "Invalid authorization code" or "Code expired"

**Root cause:** Code already used or took too long to exchange.

**Fixes:**

- Exchange code IMMEDIATELY in callback (codes expire in 10 minutes)
- Never retry code exchange — code is single-use
- Check system clock is synchronized (time drift causes expiration)
- Verify callback URL in dashboard matches actual redirect

### "signin_consent_denied" error

**Root cause:** User clicked "Cancel" or "Deny" on consent screen.

**Fix:** Display helpful message:

```
"You declined to sign in. If this was unexpected, contact your IT admin —
they may need to review your access settings or investigate potential phishing."
```

Do NOT treat as system error. This is a user action.

### "Organization not found" or "Domain not recognized"

**Root cause:** Email domain doesn't match any organization's verified domains.

**Fixes:**

- Verify organization has domain added in dashboard
- Check domain verification status (must be verified)
- For guest domains: confirm organization has guest access enabled
- Try connection/organization ID instead of domainHint

### Callback receives error page instead of code

**Root cause:** Redirect URI mismatch or IdP misconfiguration.

**Fixes:**

- Dashboard → Redirect URIs → verify exact match (including protocol, port, path)
- Check for trailing slashes (http://app.com/callback ≠ http://app.com/callback/)
- If using ngrok: update redirect URI to current ngrok URL
- For IdP issues: regenerate connection in dashboard (some IdPs cache old config)

### IdP-initiated flow fails but SP-initiated works

**Root cause:** Callback assumes state parameter exists.

**Fix:** Make state validation conditional:

```
if request.query.state:  // SP-initiated includes state
  verify_state_matches_session()
else:  // IdP-initiated may omit state
  log_idp_initiated_attempt()
```

Check fetched docs for state handling recommendations.

## Launch Checklist

Before production launch:

- [ ] Both SP-initiated and IdP-initiated flows tested
- [ ] Error responses display user-friendly messages
- [ ] State validation prevents CSRF attacks
- [ ] Redirect URIs in dashboard match production URLs
- [ ] Guest domain policy decided (allow/deny external emails)
- [ ] Support process for "signin_consent_denied" errors
- [ ] Session timeout matches IdP session lifetime
- [ ] Single logout tested (if using OIDC)

Check fetched docs for complete launch checklist with security considerations.
