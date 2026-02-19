<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for SSO implementation:

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

Check for these in your environment (`.env`, `.env.local`, or deployment platform):

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`

### SDK Installation

Verify WorkOS SDK is installed:

```bash
# Check package.json or equivalent dependency manifest
grep -i workos package.json requirements.txt Gemfile pom.xml 2>/dev/null
```

If missing, install SDK for your language — check fetched docs for package names.

## Step 3: Login Flow Decision Tree (CRITICAL)

SSO has TWO distinct login flows. Your implementation MUST handle BOTH.

```
User initiates login from where?
  |
  +-- Your app's login page
  |     └─> Service Provider-Initiated (SP-initiated)
  |         • User enters email
  |         • You call SDK method for authorization URL with organization parameter
  |         • Redirect user to that URL
  |         • IdP redirects back to YOUR callback with code
  |
  +-- Identity Provider dashboard
        └─> Identity Provider-Initiated (IdP-initiated)
            • User clicks your app icon in their IdP
            • IdP redirects DIRECTLY to YOUR callback with code
            • NO authorization URL step
```

**Trap:** Developers forget to test IdP-initiated flow. Your callback MUST work when user arrives from IdP without going through your login page first.

**Testing:** Use WorkOS Test Identity Provider (see Step 4) to simulate BOTH flows before production.

## Step 4: Testing Strategy

### Phase 1: Test Identity Provider (Fastest)

WorkOS provides a pre-configured Test Organization with Test IdP connection. This is the FIRST thing you test.

1. Log into [WorkOS Dashboard](https://dashboard.workos.com/)
2. Navigate to "Test SSO" page
3. Follow scenario instructions for:
   - SP-initiated flow (user starts at your app)
   - IdP-initiated flow (user starts at IdP)
   - Guest email domains (non-organization email)
   - Error responses

**Critical:** Test IdP-initiated flow BEFORE writing production code. Many apps break here.

### Phase 2: Real Identity Provider (Customer Experience)

Once Test IdP works, test with a real IdP (Okta, Google, Azure AD, etc.) to understand customer setup:

1. Create organization in Dashboard
2. Click "Invite admin" → "Single Sign-On"
3. Copy setup link (goes to Admin Portal)
4. Create account with chosen IdP
5. Follow Admin Portal instructions to configure connection
6. Test both login flows again

Check fetched docs for IdP-specific setup guides.

## Step 5: Callback Implementation

Your callback route receives OAuth code from IdP. Structure:

```
Callback receives:
  |
  +-- Success: ?code=<auth_code>&state=<state>
  |     └─> Exchange code for user profile using SDK method
  |         └─> Create session, redirect to app
  |
  +-- Error: ?error=<code>&error_description=<msg>&state=<state>
        └─> Handle specific error codes (see Step 6)
```

**SDK method pattern:**

1. Call SDK method to exchange code for user profile
2. Extract user data: `user.id`, `user.email`, `user.first_name`, `user.last_name`
3. Extract organization: `organization_id`
4. Create application session with user data
5. Redirect to authenticated area

Check fetched docs for exact SDK method signature (varies by language).

**State parameter:** Preserve `state` from authorization URL through callback to prevent CSRF. Check fetched docs for state handling requirements.

## Step 6: Error Recovery

### Error Code Decision Tree

When callback receives `?error=<code>`:

```
Error code?
  |
  +-- signin_consent_denied
  |     └─> User cancelled at IdP consent screen
  |         Action: Show message directing user to contact admin
  |         Context: Possible phishing detection by user
  |
  +-- access_denied
  |     └─> User not authorized in IdP
  |         Action: Show "Contact your admin" message
  |
  +-- invalid_request
  |     └─> Malformed authorization request
  |         Action: Check authorization URL parameters
  |         Common cause: Missing organization or connection ID
  |
  +-- other codes
        └─> Check fetched docs for complete error code table
```

**Critical:** Display actionable messages. Users cannot fix SSO errors themselves — they need admin contact info.

### "Connection not found"

**Symptom:** Authorization URL returns 404 or "connection not found"

**Diagnosis tree:**

```
Connection exists in Dashboard?
  |
  +-- No --> Create connection via Admin Portal or Dashboard
  |
  +-- Yes --> Check connection state
        |
        +-- "Draft" --> Connection not activated
        |               Action: Complete setup in Admin Portal
        |
        +-- "Active" --> Check organization parameter
                         |
                         +-- Passing organization ID? 
                         |     └─> Verify ID matches Dashboard
                         |
                         +-- Passing domain? 
                               └─> Check domain verification status
```

### "Redirect URI mismatch"

**Symptom:** Error after IdP redirects back

**Root cause:** Callback URL in authorization request doesn't match Dashboard configuration

**Fix:**

1. Get exact callback URL from your code: `https://your-app.com/auth/callback`
2. Open [Dashboard → Redirects](https://dashboard.workos.com/redirects)
3. Add EXACT URL (protocol, domain, path must match)
4. Retry login flow

**Trap:** Localhost URLs require exact port match (`http://localhost:3000/callback` ≠ `http://localhost:3001/callback`)

### IdP-Initiated Flow Breaks

**Symptom:** SP-initiated works, IdP-initiated fails

**Common causes:**

1. **Session state validation too strict** — IdP-initiated has no prior session
   - Fix: Make state validation conditional, not required
2. **Login page redirect loop** — callback redirects to login, login has no context
   - Fix: Callback should create session directly, skip login page
3. **Organization lookup fails** — no way to determine which org user belongs to
   - Fix: Use `organization_id` from profile data, not from session

**Verification command:**

```bash
# Simulate IdP-initiated callback (replace with your callback URL)
curl -I "http://localhost:3000/callback?code=test_code&state=idp_initiated"
# Should return 302 to authenticated area, NOT to login page
```

### Guest Email Domain Issues

**Symptom:** User with non-organization email (e.g., contractor@gmail.com) cannot log in

**Cause:** Connection configured for specific domains only

**Fix:** Check fetched docs for "guest email domain" or "JIT provisioning" configuration. May require Dashboard setting change.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables present
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID

# 2. SDK installed
# (Language-specific — check package manifest)

# 3. Test SP-initiated flow
# (Manual: Start at your login page, enter test email, complete flow)

# 4. Test IdP-initiated flow (CRITICAL)
# (Manual: Start at Dashboard → Test SSO → IdP-initiated test, click link)

# 5. Error handling works
# (Manual: Dashboard → Test SSO → Error response test)

# 6. Application builds
# (Language-specific build command)
```

**If test #4 fails:** Review Step 3 callback logic. IdP-initiated has no authorization URL phase.

## Step 7: Launch Checklist

Before production:

1. **Redirect URIs:** Production URLs added to Dashboard
2. **Environment variables:** Production `WORKOS_API_KEY` and `WORKOS_CLIENT_ID` set
3. **Error messages:** User-facing errors mention "contact your admin" with support email
4. **Session duration:** Appropriate for your app (check fetched docs for session management)
5. **Single Logout (optional):** If using OIDC connections, check fetched docs for logout endpoint setup

Check fetched docs for complete launch checklist — includes security considerations like certificate validation.

## Advanced: Single Logout

**Availability:** OpenID Connect connections only (not SAML)

**Pattern:** When user logs out of your app, redirect to WorkOS logout endpoint to end IdP session.

**When to implement:** If users access multiple SSO apps and expect logout from one to log out of all.

Check fetched docs for exact endpoint URL and parameters — varies by connection type.

## Related Skills

For frontend integration with SSO:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
