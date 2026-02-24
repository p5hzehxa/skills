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

Check environment for:
- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`
- SDK package installed

**Verify:**
```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing sk_ prefix"
```

## Step 3: Login Flow Decision Tree (CRITICAL)

How does your app identify the user's organization?

```
User identification method?
  |
  +-- Email domain (user@acme.com → acme.com org)
  |     → Use: domainHint parameter in getAuthorizationUrl()
  |     → Pattern: Extract domain from email, pass as domainHint
  |
  +-- Organization selector (dropdown/list before login)
  |     → Use: organization parameter with org_id
  |     → Pattern: User picks org → get org_id → pass to getAuthorizationUrl()
  |
  +-- Known connection (direct link from org admin panel)
        → Use: connection parameter with conn_id
        → Pattern: Pre-select connection → pass conn_id to getAuthorizationUrl()
```

**Trap:** Do NOT combine domainHint + organization parameters — use ONE.

**Implementation pattern:**
```
authorization_url = workos.sso.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: random_state_string,
  
  // Pick ONE based on decision tree above:
  domainHint: "acme.com"          // OR
  organization: "org_123"         // OR  
  connection: "conn_456"
})

// Redirect user to authorization_url
```

## Step 4: Implement Callback Handler

**Critical:** Your callback route MUST handle BOTH success and error cases.

Success response parameters:
- `code` — exchange this for user profile
- `state` — verify matches your original state

Error response parameters:
- `error` — error code (see Error Recovery)
- `error_description` — human-readable message
- `state` — verify matches your original state

**Pattern:**
```
callback_handler(request):
  received_state = request.query.state
  
  // ALWAYS verify state first
  if received_state != session.stored_state:
    return error("Invalid state - possible CSRF")
  
  if request.query.error:
    return handle_error(request.query.error, request.query.error_description)
  
  code = request.query.code
  profile = workos.sso.getProfileAndToken({ code })
  
  // profile contains: user.id, user.email, user.firstName, user.lastName, organizationId
  return create_session(profile)
```

## Step 5: IdP-Initiated Flow Support (TRAP WARNING)

**Most agents forget this:** Users can start login FROM their IdP dashboard, not your app.

Your callback handler from Step 4 MUST work without your app creating the initial state:

```
IdP-initiated flow?
  |
  +-- YES: state will be empty string ("") in callback
  |     → Verify state is empty, not missing
  |     → Create session normally — code exchange still works
  |
  +-- NO (SP-initiated): state matches your generated value
        → Proceed with normal state verification
```

**Verification command:**
```bash
# Simulate IdP-initiated callback (no state)
curl "http://localhost:3000/callback?code=test_code&state=" && echo "✓ handles empty state" || echo "✗ rejects empty state"
```

## Step 6: Single Logout Integration (Optional)

If your app needs logout propagation to the IdP, implement this pattern:

1. User clicks logout in your app
2. Call SDK method for logout URL
3. Redirect user to logout URL
4. IdP terminates their session
5. IdP redirects back to your app

Check fetched docs for exact logout URL generation method and parameters.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Verify authorization URL contains required parameters
grep -r "getAuthorizationUrl" src/ || echo "✗ No SSO implementation found"

# 2. Verify callback handler checks state parameter
grep -r "state.*==" src/ | grep -i callback || echo "✗ No state verification in callback"

# 3. Verify callback handles error parameter
grep -r "error.*query" src/ | grep -i callback || echo "✗ No error handling in callback"

# 4. Confirm env vars configured
env | grep WORKOS && echo "✓ WorkOS env vars present" || echo "✗ Missing WorkOS env vars"
```

## Error Recovery

### `signin_consent_denied` (User cancelled at IdP)

**Cause:** User clicked "Cancel" or "Deny" at IdP consent screen.

**Recovery:**
1. Display: "Authentication cancelled. Contact your IT admin if this was unexpected."
2. Log: organization_id + user_email for support investigation
3. Provide: Link back to login page
4. DO NOT retry automatically — user explicitly denied

### `invalid_grant` (Code expired or reused)

**Cause:** Callback code exchanged >10 minutes after generation, or exchanged twice.

**Recovery:**
1. Clear stored state
2. Redirect user back to login flow — generate new authorization URL
3. DO NOT reuse the same code

### `signin_disabled` (Connection inactive)

**Cause:** Organization admin deactivated SSO connection in WorkOS Dashboard.

**Recovery:**
1. Display: "SSO login unavailable. Contact your admin or use email/password login."
2. Alert internal team — customer may be churning
3. Provide fallback login method if available

### Generic error response structure

All SSO errors arrive as URL parameters:
```
?error=error_code&error_description=Human+message&state=original_state
```

Check fetched docs for complete error code list — there are 10+ codes with specific meanings.

## Related Skills

For AuthKit-based SSO implementations (managed auth UI):
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
