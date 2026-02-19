<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

These docs are the source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Flight Validation

### Dashboard Access

- Confirm access to https://dashboard.workos.com/
- Verify API keys exist: `WORKOS_API_KEY` (starts with `sk_`), `WORKOS_CLIENT_ID` (starts with `client_`)
- Check environment: staging has Test Organization pre-configured, production requires real organizations

### Project Structure

- Confirm SDK is installed: check `node_modules/@workos-inc` or equivalent for your language
- Confirm environment variables are loaded (`.env`, `.env.local`, or deployment config)

## Step 3: Understand the SSO Architecture

SSO in WorkOS requires three entities:

```
Organization (your customer)
  └── Connection (SSO configuration for a specific IdP)
       └── Domain (verified email domain like "acme.com")
```

**Decision tree for authentication flow:**

```
User enters email
  |
  +-- Email domain matches connection domain?
  |     |
  |     YES --> Redirect to IdP via authorization URL
  |     |
  |     NO --> Error: no SSO connection found
  |
  +-- IdP authenticates user
  |
  +-- IdP redirects to YOUR redirect URI with code
  |
  +-- Exchange code for user profile
```

**Critical:** Your redirect URI must be registered in Dashboard → Configuration → Redirect URIs. Unregistered URIs will fail.

## Step 4: Implement Authorization URL Generation

Your sign-in page needs to redirect users to the IdP. Pattern:

```
User submits email
  |
  +-- Extract domain from email
  |
  +-- Call SDK method to generate authorization URL
  |     (Check fetched docs for exact method signature)
  |     Parameters needed:
  |       - organization: organization ID (org_*)
  |       - redirect_uri: your callback URL
  |       - state: CSRF token (you generate)
  |       - connection: (optional) connection ID if known
  |       - domain_hint: (optional) email domain for auto-detection
  |
  +-- Store state in session for verification
  |
  +-- HTTP 302 redirect to authorization URL
```

**CRITICAL:** Always generate and verify `state` parameter to prevent CSRF attacks. Never skip this.

## Step 5: Implement Callback Handler

Your redirect URI receives the authorization code. Pattern:

```
GET /callback?code=...&state=...
  |
  +-- Verify state matches session (CSRF protection)
  |     |
  |     Mismatch? --> 400 error, do not proceed
  |
  +-- Exchange code for profile
  |     (Check fetched docs for exact SDK method)
  |     Returns: user profile + access_token
  |
  +-- Extract user data:
  |     - id (unique user identifier)
  |     - email
  |     - first_name, last_name
  |     - raw_attributes (IdP-specific claims)
  |
  +-- Create/update user in your database
  |
  +-- Create session, set cookies
  |
  +-- Redirect to dashboard/home
```

**Trap warning:** Authorization codes expire quickly (typically 10 minutes). Exchange immediately upon receiving callback.

## Step 6: Handle Error Responses

Callback may receive error instead of code:

```
GET /callback?error=...&error_description=...&state=...
```

**Common error codes:**

- `signin_consent_denied` - User declined sign-in consent prompt
- `access_denied` - IdP rejected authentication
- `invalid_request` - Malformed authorization request
- `server_error` - IdP server error

**Error handling pattern:**

```
Error received?
  |
  +-- error === "signin_consent_denied"?
  |     |
  |     YES --> Display: "Sign-in was cancelled. Contact your admin if this was unexpected."
  |           (Possible phishing attempt detected by user)
  |
  +-- Other errors --> Log error details, display generic message
                       "Authentication failed. Please try again or contact support."
```

Check fetched docs for complete error code reference.

## Step 7: Test with Test Identity Provider

Dashboard → Test SSO page provides pre-configured test environment.

**Test cases to run (in order):**

### 7a. Service Provider-Initiated (SP-Initiated)

User starts at YOUR sign-in page:

1. Navigate to your sign-in page
2. Enter test email from Dashboard (e.g., `user@example.com`)
3. Submit form → should redirect to Test IdP
4. Click "Sign In" on Test IdP page
5. Should redirect back to your app with user profile

**Verify:** User session created, dashboard accessible

### 7b. Identity Provider-Initiated (IdP-Initiated)

User starts at THEIR IdP:

1. Dashboard → Test SSO → Copy IdP-initiated URL
2. Paste URL in browser (simulates user clicking app icon in IdP)
3. Should land directly in your app, authenticated

**Critical:** Many developers forget to support IdP-initiated flow. This is a common production issue.

**Verify:** No error, user authenticated without visiting your sign-in page first

### 7c. Guest Email Domain

User email domain differs from organization's verified domain:

1. Use test email with different domain (e.g., `freelancer@gmail.com`)
2. Should authenticate if connection allows guest domains

Check fetched docs for "guest email domain" configuration in Dashboard.

### 7d. Error Simulation

1. Dashboard → Test SSO → Click "Trigger Error"
2. Should redirect to callback with `error` parameter
3. Verify your error handler displays appropriate message

**Verify:** No stack traces exposed, user-friendly error message shown

## Step 8: Test with Real Identity Provider (Optional)

If you need to test with Okta, Azure AD, Google Workspace, etc.:

### 8a. Create Test Organization

Dashboard → Organizations → Create organization

- Name: "Test Acme Corp"
- Domains: Add a domain you control (e.g., your company's domain)

### 8b. Create SSO Connection

Organization page → Invite admin → Select "Single Sign-On"

Options:
- Send setup link via email, OR
- Copy setup link and complete yourself

Setup link opens Admin Portal with IdP-specific instructions.

### 8c. Follow Admin Portal Instructions

Admin Portal provides step-by-step setup for each IdP:
- Where to find SSO settings in IdP dashboard
- What values to copy from WorkOS (ACS URL, Entity ID, etc.)
- What values to copy from IdP (SSO URL, certificate, etc.)

Complete the IdP configuration, then mark setup as complete in Admin Portal.

### 8d. Test Authentication

Use the flow from Step 7a with an email matching the organization's domain.

**Verify:** Authentication completes with real IdP, user profile data returned

## Step 9: Implement Single Logout (Optional)

Check fetched docs for current Single Logout support status — implementation is limited to specific IdP types.

**Pattern for RP-initiated logout:**

```
User clicks "Sign Out"
  |
  +-- Clear local session/cookies
  |
  +-- Redirect to WorkOS logout endpoint
  |     (Check fetched docs for endpoint URL and required parameters)
  |     Parameters needed:
  |       - session_id: from original authentication
  |
  +-- WorkOS redirects to IdP logout
  |
  +-- IdP logs user out of all SSO apps
  |
  +-- IdP redirects back to your post-logout page
```

**Critical:** Not all IdPs support Single Logout. Check fetched docs for compatibility matrix.

## Step 10: Production Checklist

Before launching SSO to customers:

- [ ] Redirect URIs registered in Dashboard for ALL environments (dev, staging, prod)
- [ ] Error handling covers all error codes from fetched docs
- [ ] CSRF protection via `state` parameter implemented
- [ ] Session management handles both SP-initiated and IdP-initiated flows
- [ ] User database schema accommodates SSO user IDs (external identifiers)
- [ ] Support documentation written for customer IT admins
- [ ] Admin Portal integrated or setup links documented

Check fetched "launch-checklist" doc for complete pre-launch requirements.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. SDK installed
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: WorkOS SDK not installed"

# 2. Environment variables set
[ -n "$WORKOS_API_KEY" ] && [ -n "$WORKOS_CLIENT_ID" ] || echo "FAIL: API keys not configured"

# 3. Redirect URI endpoint exists (adjust path for your framework)
grep -r "GET.*callback\|/callback" . 2>/dev/null | head -1 || echo "FAIL: Callback route not found"

# 4. State verification implemented (CSRF protection)
grep -r "state.*verify\|verify.*state" . 2>/dev/null | head -1 || echo "FAIL: State verification not found"

# 5. Build succeeds
npm run build 2>&1 | tail -1
```

**If check #4 fails:** Go back to Step 4 and implement state parameter verification. This prevents CSRF attacks.

## Error Recovery

### "Redirect URI not registered"

**Symptom:** Callback fails with "redirect_uri mismatch" error

**Fix:**
1. Dashboard → Configuration → Redirect URIs
2. Add EXACT callback URL (including protocol, domain, path)
3. Note: `http://localhost:3000/callback` ≠ `http://127.0.0.1:3000/callback`

### "Invalid authorization code"

**Root cause:** Code expired or already used (codes are single-use)

**Fix:**
1. Check: Time between receiving code and exchanging it < 10 minutes
2. Check: No duplicate callback handler execution (prevents double-exchange)
3. Check: User didn't refresh the callback URL (generates new request)

### "Organization not found" or "Connection not found"

**Root cause:** User email domain doesn't match any configured connection

**Fix:**
1. Verify organization exists in Dashboard
2. Verify connection is active (Dashboard → Organization → Connections)
3. Verify domain is added to connection
4. Check: Domain in lowercase (domain matching is case-insensitive but store lowercase)

### "signin_consent_denied in production"

**Root cause:** User saw unexpected sign-in consent screen (possible phishing attempt)

**Fix:**
1. Display message: "You cancelled sign-in. If you didn't expect this screen, contact your IT admin immediately."
2. Log event for security review
3. Educate users about legitimate vs. phishing consent screens

Check fetched docs "saml-security" and "sign-in-consent" for security best practices.

### "IdP-initiated flow fails but SP-initiated works"

**Root cause:** Application expects specific entry point or session data

**Fix:**
1. Check: Callback handler doesn't assume user came from your sign-in page
2. Check: No session data required before authentication completes
3. Test: Direct navigation to IdP-initiated URL from fetched docs

### "User profile missing expected claims"

**Root cause:** IdP not configured to send required attributes

**Fix:**
1. Check `raw_attributes` field in user profile (contains all IdP claims)
2. Update IdP configuration to include missing attributes
3. See fetched docs for IdP-specific attribute mapping

### Build/Runtime Errors

**"Cannot read property 'id' of undefined"**
- Root cause: Code exchange failed but error not caught
- Fix: Wrap code exchange in try-catch, check for null response

**"Session expired during authentication"**
- Root cause: Authentication took too long, state parameter session expired
- Fix: Increase session timeout for auth flow, or store state in different mechanism (signed cookie, database)

## Related Skills

- workos-authkit-nextjs — For Next.js apps preferring pre-built auth UI
- workos-authkit-react — For React apps with custom UI but managed auth state
