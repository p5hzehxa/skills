<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest SSO implementation details:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

These docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Prerequisites

- WorkOS SDK installed (language-specific package)
- Active WorkOS account with dashboard access
- Callback URL configured in your app's routing

**Verify SDK installation before writing code:**

```bash
# Node.js
test -d node_modules/@workos-inc && echo "PASS" || echo "FAIL: SDK not installed"

# Python
python -c "import workos" 2>/dev/null && echo "PASS" || echo "FAIL: SDK not installed"

# Ruby
ruby -e "require 'workos'" 2>/dev/null && echo "PASS" || echo "FAIL: SDK not installed"
```

## Step 3: SSO Connection Setup (Decision Tree)

Choose your connection setup path:

```
Connection setup method?
  |
  +-- Testing/POC --> Use Test Identity Provider (Dashboard → Test SSO)
  |                   No IdP configuration needed
  |                   Default Test Organization exists in staging
  |
  +-- Production   --> Real IdP integration
      |
      +-- Self-serve --> Integrate Admin Portal (allows customers to configure)
      |
      +-- Manual     --> Create Organization → Create Connection → Follow IdP-specific setup
```

### Testing Path (Recommended First)

Dashboard → Test SSO page provides:

- Pre-configured Test Organization (domain: `example.com`)
- Active SSO connection with Test IdP
- Test scenarios: SP-initiated, IdP-initiated, guest domains, error responses

**Critical:** If using AuthKit elsewhere in your app, disable it in Dashboard before testing. AuthKit intercepts auth flows and will interfere with SSO testing.

### Production Path

For each customer organization:

1. Dashboard → Organizations → Create Organization
2. Organization → Invite admin → Select "Single Sign-On"
3. Send setup link to customer admin OR copy link to send via your own channel
4. Customer follows Admin Portal instructions (IdP-specific)

Check fetched docs for complete Admin Portal integration options.

## Step 4: Implement Authorization Flow (Decision Tree)

Choose the login flow pattern your app needs to support:

```
Login initiation?
  |
  +-- Service Provider (SP) initiated
  |   User enters email → App redirects to IdP → IdP redirects back
  |   Most common flow, start here
  |
  +-- Identity Provider (IdP) initiated
  |   User logs into IdP first → Selects your app → Redirected to your app
  |   CRITICAL: Many apps forget this. Test it.
  |
  +-- Both (recommended for production)
      Handle both entry points
```

### SP-Initiated Flow Implementation

**Pattern (language-agnostic):**

1. User submits email on your login page
2. Call SDK method to generate authorization URL (provides organization context)
3. Redirect user to authorization URL
4. User authenticates at IdP
5. IdP redirects to your callback URL with code parameter
6. Exchange code for profile using SDK method
7. Create session in your app

Check fetched docs for exact SDK method signatures for your language.

### IdP-Initiated Flow (TRAP WARNING)

**Critical difference:** No `state` parameter in callback. Your callback handler MUST handle both flows:

```
Callback receives state parameter?
  |
  +-- Yes --> SP-initiated flow (validate state)
  |
  +-- No  --> IdP-initiated flow (skip state validation)
```

**Do NOT reject** callbacks without state — this breaks IdP-initiated SSO.

### Guest Email Domain Handling

Users may authenticate with email domains different from the organization's verified domain (e.g., freelancers with personal emails).

Check fetched docs for `guest_email_domain` configuration in connection settings.

## Step 5: Implement Callback Handler

Create route at your configured callback URL (e.g., `/auth/callback`).

**Handler logic (pseudocode):**

```
1. Extract `code` parameter from query string
   IF missing: Check for `error` and `error_description` → Handle error (see Error Recovery)

2. Exchange code for user profile via SDK method
   Use your WORKOS_CLIENT_ID for authentication

3. Extract profile data:
   - email
   - id (unique identifier)
   - organization_id
   - connection_id
   - Additional fields per fetched docs

4. Create session in your app
   Store user ID and organization context

5. Redirect to app dashboard/home
```

**CRITICAL:** Code is single-use and time-limited. Exchange immediately. Do NOT cache codes.

Check fetched docs for complete profile schema and SDK method for code exchange.

## Step 6: Error Handling (REQUIRED)

### Callback Error Responses

When callback receives `error` parameter instead of `code`:

```
Error code received?
  |
  +-- signin_consent_denied
  |   User rejected sign-in consent prompt
  |   Display: "Sign-in was cancelled. Contact your admin if this was unexpected."
  |   Log for phishing attempt investigation
  |
  +-- access_denied
  |   User denied access at IdP
  |   Display: "Access denied. Please contact your administrator."
  |
  +-- Other errors
      Check fetched docs for complete error code table
      Log error_description for debugging
```

**Pattern for error parameter extraction:**

```
URL: https://your-app.com/callback?error=signin_consent_denied&error_description=User%20cancelled&state=xyz

Extract:
- error: signin_consent_denied
- error_description: URL-decoded description
- state: (may be present for SP-initiated, absent for IdP-initiated)
```

**Do NOT treat all errors the same.** `signin_consent_denied` indicates user action, not system failure.

### Code Exchange Failures

```bash
# Common causes:
# - Code already used (replay attempt)
# - Code expired (took too long)
# - Wrong CLIENT_ID
# - Network timeout

# Response: Display generic error, log details server-side
# DO NOT expose internal error messages to user
```

## Step 7: Single Logout (Optional)

**Availability:** OpenID Connect (OIDC) connections only. SAML does not support Single Logout.

```
Logout scope?
  |
  +-- App-only logout
  |   Clear session in your app
  |   User remains logged into IdP
  |
  +-- Single Logout (RP-initiated)
      Redirect to WorkOS logout endpoint
      User logged out of app AND all SSO-connected apps
```

**Implementation for Single Logout:**

Check fetched docs for Logout Redirect endpoint URL pattern. Redirect user to this endpoint with your connection details.

**Critical:** This ends ALL SSO sessions, not just your app. Confirm user intent before triggering.

## Step 8: Connection ID vs Organization ID (Decision Tree)

When generating authorization URLs, choose identifier strategy:

```
Use case?
  |
  +-- Multi-tenant app with known organization
  |   Use organization_id (most common)
  |   Get org ID from user's account context
  |
  +-- Direct connection reference
  |   Use connection_id
  |   Less common, used when bypassing org lookup
  |
  +-- Domain-based routing
      Use domain parameter
      Auto-select connection based on email domain
```

**Trap warning:** Do NOT hardcode connection IDs. They change when customers reconfigure SSO. Use organization_id or domain for stable references.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables exist
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" && echo "PASS" || echo "FAIL: Missing env vars"

# 2. SDK installed and importable
# (Use language-specific check from Step 2)

# 3. Test SSO flow end-to-end
# Manual: Dashboard → Test SSO → Follow SP-initiated scenario
# Verify: User redirected to Test IdP, can log in, redirected back to callback

# 4. Test IdP-initiated flow
# Manual: Dashboard → Test SSO → Follow IdP-initiated scenario
# Verify: Callback receives profile WITHOUT state parameter

# 5. Test error handling
# Manual: Dashboard → Test SSO → Follow error response scenario
# Verify: App displays error message, does not crash

# 6. Build succeeds
# (Language-specific build command)
```

**If check #3 or #4 fails:** Verify callback handler supports both flows (state parameter may be absent).

## Error Recovery

### "Invalid client_id" during code exchange

**Root cause:** Wrong `WORKOS_CLIENT_ID` in environment.

**Fix:**

1. Dashboard → API Keys → Copy Client ID
2. Verify environment variable matches exactly (no extra spaces/quotes)
3. Restart app to reload environment

### "Code already used" error

**Root cause:** Callback handler running twice (double-submit, page refresh).

**Fix:**

1. Implement idempotency: Check if user session already exists before exchanging code
2. Redirect immediately after session creation (do not render page at callback URL)
3. Use POST-redirect-GET pattern if possible

### "Authorization code expired"

**Root cause:** User took too long between IdP login and callback (network latency, debugging).

**Fix:**

1. Display: "Login expired. Please try again."
2. Redirect to login page
3. Log time delta between code generation and exchange (check for bottlenecks)

### Callback receives no parameters (blank)

**Root cause:** IdP redirect misconfigured or user cancelled before completion.

**Fix:**

1. Check Dashboard → Connections → Your Connection → Redirect URI matches exactly
2. Verify IdP configuration has correct callback URL (check Admin Portal steps)
3. Do NOT assume parameters exist — validate before accessing

### User authenticated but wrong organization profile returned

**Root cause:** User has accounts in multiple organizations, wrong context selected.

**Fix:**

1. If using `domain` parameter: Check domain extraction logic (typos, case sensitivity)
2. If using `organization_id`: Verify ID matches user's expected org
3. Display organization name in UI for user confirmation

### "Sign-in consent denied" appearing unexpectedly

**Root cause:** User's IdP admin enabled sign-in consent, but user doesn't recognize your app.

**Fix:**

1. Display detailed message: "Your IT admin requires consent for this app. Contact [support email] if you believe this is incorrect."
2. Log event with user email, organization_id for phishing investigation
3. Check fetched docs for sign-in consent configuration options

**Do NOT disable consent** — it's a security feature. Improve messaging instead.

## Related Skills

- workos-authkit-nextjs — For Next.js apps using AuthKit (disable before SSO testing)
- workos-authkit-react — For React apps using AuthKit (disable before SSO testing)
