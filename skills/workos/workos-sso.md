---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest SSO implementation details:

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/sso/launch-checklist

The fetched docs are the source of truth. If this skill conflicts with them, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these in `.env` or `.env.local`:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `WORKOS_REDIRECT_URI` - your callback URL (must match Dashboard config)

### SDK Installation

Verify SDK exists for your language:

```bash
# Node.js
ls node_modules/@workos-inc/node 2>/dev/null

# Python
python -c "import workos" 2>/dev/null

# Ruby
ruby -e "require 'workos'" 2>/dev/null

# Go
go list -m github.com/workos/workos-go 2>/dev/null
```

If SDK missing, install before continuing. Check fetched docs for language-specific installation.

## Step 3: Login Flow Decision Tree

```
User authentication source?
  |
  +-- User clicks "Sign In" in your app
  |   --> Service Provider-Initiated (SP-initiated)
  |   --> Continue to Step 4
  |
  +-- User selects your app from IdP dashboard
      --> Identity Provider-Initiated (IdP-initiated)
      --> Continue to Step 5
```

**CRITICAL:** You MUST handle BOTH flows. Most developers only implement SP-initiated and break IdP-initiated login.

## Step 4: SP-Initiated SSO Implementation

This is the standard flow: user enters email → redirect to IdP → callback to your app.

### Organization/Connection Resolution

```
How to identify which IdP to use?
  |
  +-- User enters email with known domain
  |   --> Look up organization by domain
  |   --> Use organization ID in authorization URL
  |
  +-- User enters email with unknown domain
  |   --> Check if guest access allowed
  |   --> If yes: redirect with organization + email
  |   --> If no: show error "SSO not configured"
  |
  +-- User already logged in to another org
      --> Use connection ID directly (skip lookup)
```

### Authorization URL Generation

Pseudocode pattern (check fetched docs for exact SDK method):

```
params = {
  organization: org_id_from_lookup,  // OR connection_id
  redirect_uri: WORKOS_REDIRECT_URI,
  state: generate_random_state(),     // Store in session
  // Optional:
  domain_hint: user_email_domain,
  login_hint: user_email
}

authorization_url = sdk.generate_authorization_url(params)
redirect_user_to(authorization_url)
```

**CRITICAL:** Store `state` parameter in session. You MUST verify it in callback to prevent CSRF.

### Callback Handler

User returns to `WORKOS_REDIRECT_URI` with `code` and `state` parameters.

Pseudocode pattern:

```
# 1. Verify state
if request.params.state != session.stored_state:
  return error("Invalid state - possible CSRF")

# 2. Handle error responses FIRST
if request.params.error:
  error_code = request.params.error
  error_description = request.params.error_description
  
  if error_code == "signin_consent_denied":
    # User explicitly denied consent - show helpful message
    return show_consent_denied_page()
  else:
    # Generic error - log and show retry
    log_error(error_code, error_description)
    return show_sso_error_page()

# 3. Exchange code for profile
profile = sdk.get_profile_and_token(code: request.params.code)

# 4. Create session
session.user_id = profile.id
session.email = profile.email
session.organization_id = profile.organization_id

# 5. Redirect to app
redirect_to("/dashboard")
```

**Profile structure (varies by language - check docs):**
- `id` - WorkOS user ID (string like `user_01H7ZKDG...`)
- `email` - User's email address
- `first_name`, `last_name` - User attributes (may be null)
- `organization_id` - Which org they authenticated with (string like `org_01H7ZK...`)
- `connection_id` - Which SSO connection was used
- `raw_attributes` - IdP-specific attributes (varies by provider)

## Step 5: IdP-Initiated SSO Implementation

This flow starts at the IdP - user is already authenticated, your app receives the callback directly.

**TRAP:** This flow has NO `state` parameter because it didn't originate from your app.

Pseudocode pattern for callback handler:

```
# IdP-initiated detection
if request.params.code AND NOT request.params.state:
  # This is IdP-initiated - cannot verify CSRF
  # Additional security: check connection_id in profile matches expected org
  
  profile = sdk.get_profile_and_token(code: request.params.code)
  
  # CRITICAL: Validate the user/org before creating session
  if not is_valid_organization(profile.organization_id):
    return error("SSO not enabled for this organization")
  
  # Create session (same as SP-initiated from step 4)
  session.user_id = profile.id
  # ...
  
  redirect_to("/dashboard")
```

**CRITICAL:** Your callback handler MUST support BOTH flows:
- SP-initiated: has `state` parameter → verify CSRF
- IdP-initiated: no `state` parameter → validate org instead

## Step 6: Guest Email Domain Handling

Some organizations allow users with non-company email domains (contractors, freelancers).

Check fetched docs for org-level setting. Pattern:

```
User email: contractor@freelance.com
Org domain: company.com (verified)
Guest domain: freelance.com (unverified)

If org allows guest domains:
  authorization_url = sdk.generate_authorization_url(
    organization: org_id,
    email: "contractor@freelance.com",  // Pass explicitly
    redirect_uri: WORKOS_REDIRECT_URI
  )
Else:
  return error("Email domain not authorized")
```

## Step 7: Single Logout (Optional)

**NOTE:** Single Logout is ONLY supported for OIDC connections. SAML does not support SLO in WorkOS.

To log user out of both your app AND the IdP:

Pseudocode pattern:

```
# Check if connection supports logout
if profile.connection_type == "OIDC":
  # Redirect to WorkOS logout endpoint
  logout_url = sdk.get_logout_url(
    session_id: session.workos_session_id  // from initial auth
  )
  
  # Clear local session
  session.clear()
  
  # Redirect to IdP logout
  redirect_to(logout_url)
else:
  # SAML or other - local logout only
  session.clear()
  redirect_to("/login")
```

Check fetched docs for:
- Whether RP-initiated logout is available for your plan
- Exact SDK method signature for logout URL generation
- Which OIDC providers support logout

## Step 8: Testing with Test IdP

Dashboard includes a pre-configured test organization with Test Identity Provider.

### Access Test SSO page

Dashboard → _Test SSO_ → Follow scenarios:

1. **SP-initiated test:**
   - Start auth flow from your app with test org
   - Enter any email @example.com
   - Test IdP will simulate authentication
   - Verify callback succeeds

2. **IdP-initiated test:**
   - **CRITICAL:** Disable AuthKit in Dashboard first (Settings → Authentication)
   - Navigate to Test IdP link from Dashboard
   - Click your app from list
   - Verify callback succeeds WITHOUT `state` parameter

3. **Guest domain test:**
   - Start auth with email @contractor-domain.com
   - Verify org allows guest domains
   - Confirm authentication succeeds

4. **Error response test:**
   - Dashboard provides error simulation link
   - Callback receives `error=access_denied` or similar
   - Verify your error handler displays helpful message

### Testing with Real IdPs

To test with Okta, Azure AD, Google Workspace, etc.:

1. Create organization in Dashboard
2. Click _Invite admin_ → _Single Sign-On_
3. Send setup link to yourself
4. Open Admin Portal setup link
5. Follow provider-specific instructions (different for each IdP)
6. Verify connection shows "Active" in Dashboard
7. Test both SP and IdP-initiated flows

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables set
env | grep WORKOS_ | grep -q "WORKOS_API_KEY" && echo "PASS" || echo "FAIL: Missing WORKOS_API_KEY"
env | grep WORKOS_ | grep -q "WORKOS_CLIENT_ID" && echo "PASS" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 2. Callback route exists (adjust path to your framework)
grep -r "WORKOS_REDIRECT_URI\|/auth/callback\|/sso/callback" . 2>/dev/null | head -1

# 3. Authorization URL generation exists
grep -r "authorization.url\|authorize\|sso.authorize" . 2>/dev/null | head -1

# 4. Profile exchange exists
grep -r "get.*profile\|authenticate\|callback" . 2>/dev/null | grep -v node_modules | head -1

# 5. Error handling exists
grep -r "signin_consent_denied\|error.*sso\|sso.*error" . 2>/dev/null | head -1

# 6. Test both flows
curl -I "http://localhost:3000/auth/sso?email=test@example.com" | grep -q "302\|Location" && echo "PASS: SP-initiated redirects" || echo "FAIL: SP-initiated broken"

# Test IdP-initiated (requires test org callback URL)
curl -I "http://localhost:3000/sso/callback?code=test123" | grep -q "302\|200" && echo "PASS: IdP-initiated accepts callback" || echo "WARN: Check IdP-initiated handler"
```

**Manual verification:**
- [ ] Test IdP authentication succeeds in Dashboard
- [ ] SP-initiated flow: enter email → redirect → callback → session created
- [ ] IdP-initiated flow: click from IdP dashboard → callback → session created
- [ ] Error response: force error in Test IdP → see helpful error message
- [ ] Guest domain: test with non-org email if org allows guests
- [ ] State parameter verified in SP-initiated (check logs/debugger)

## Error Recovery

### "Invalid state parameter" or CSRF error

**Cause:** State verification failed in callback.

**Check:**
1. Verify you're storing state in session before redirect
2. Verify you're retrieving same state in callback
3. Check session is persistent across redirect (cookies enabled)
4. For IdP-initiated: do NOT verify state (it won't exist)

### "Organization not found" or "Domain not configured"

**Cause:** Email domain not associated with any organization.

**Fix:**
1. Check Dashboard: is domain added to organization?
2. Check if org allows guest domains (if user email is non-company)
3. Provide clear error: "SSO not configured for your email domain. Contact admin@company.com"

### "signin_consent_denied" error

**Cause:** User explicitly clicked "Deny" on SSO consent screen.

**Pattern for user-facing message:**

```
SSO authentication was cancelled.

If you believe this was not you, contact:
- Your IT administrator
- Our support team at support@yourapp.com

This may indicate a phishing attempt.
```

Do NOT treat this as a generic error. It requires user action.

### "Connection not active" or "Connection disabled"

**Cause:** SSO connection exists but is not activated in Dashboard.

**Check:**
1. Dashboard → Organizations → [Your Org] → Connections
2. Verify connection shows "Active" status
3. If "Inactive": Admin Portal setup incomplete or connection manually disabled

### Callback receives HTML instead of redirect

**Cause:** IdP returning error page instead of following redirect.

**Check:**
1. Dashboard redirect URI exactly matches your app's callback URL (including https/http)
2. IdP configuration has correct redirect URI (check Admin Portal instructions)
3. For SAML: ACS URL matches redirect URI

### Profile exchange fails with "Invalid code" or "Code expired"

**Cause:** Authorization code already used or expired (10 minute TTL).

**Common causes:**
1. Browser back button after successful auth (code already exchanged)
2. Callback handler called multiple times (middleware issue)
3. Clock skew between systems
4. Taking too long to exchange code (user waited >10 min)

**Fix:** Codes are single-use. Generate new authorization URL for retry.

### IdP-initiated flow creates duplicate sessions

**Cause:** Session created but redirect fails, user clicks again.

**Pattern:**
```
Before creating session in IdP-initiated handler:
  if session.user_id exists AND session.email == profile.email:
    # Already authenticated, just redirect
    redirect_to("/dashboard")
  else:
    # Create new session
    ...
```

### OIDC logout fails or not supported

**Cause:** Not all OIDC providers support RP-initiated logout.

**Check fetched docs for:**
- Which OIDC providers support logout (Okta, Azure AD, etc.)
- Whether your plan includes logout functionality
- Fallback to local-only logout for unsupported connections

## Related Skills

- workos-authkit-nextjs: Pre-built SSO UI for Next.js
- workos-authkit-react: Pre-built SSO UI for React
