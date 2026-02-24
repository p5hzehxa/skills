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

Check environment variables exist:
```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ API key missing or invalid"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ valid" || echo "✗ Client ID missing or invalid"
```

Confirm SDK installed:
```bash
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: User Identification Strategy (Decision Tree)

How does your app identify which organization a user belongs to?

```
User identification method?
  |
  +-- Email domain (user@company.com) --> Use domainHint parameter
  |   Example: domainHint: "company.com"
  |
  +-- Org selector UI (dropdown) --> Use organization parameter
  |   Example: organization: "org_123"
  |
  +-- Known connection ID --> Use connection parameter
      Example: connection: "conn_123"
```

**Critical:** Choose ONE. Mixing methods causes auth loops.

## Step 4: Authorization URL Generation

Construct authorization URL with chosen identification parameter:

```javascript
const authUrl = workos.sso.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: "https://your-app.com/callback",
  state: generateRandomState(), // CSRF token - verify in callback
  // Add ONE of these based on Step 3:
  domainHint: "company.com",     // OR
  organization: "org_123",       // OR
  connection: "conn_123"
});
```

Redirect user to `authUrl`. IdP handles authentication.

## Step 5: Callback Handler

Create callback endpoint at the redirect URI from Step 4.

**Critical operations (in order):**

1. Verify `state` parameter matches original (CSRF protection)
2. Exchange `code` for user profile
3. Extract user data and create session

```javascript
// In your callback handler
const { code, state } = parseCallbackParams();

// 1. Verify state
if (state !== storedState) {
  throw new Error("Invalid state - possible CSRF");
}

// 2. Exchange code for profile
const profile = await workos.sso.getProfileAndToken({
  code: code,
  clientId: WORKOS_CLIENT_ID
});

// 3. Create session
const user = {
  id: profile.id,
  email: profile.email,
  organizationId: profile.organizationId
};
```

Check fetched docs for exact `getProfileAndToken` response schema.

## Step 6: Login Flow Support (Decision Tree)

Your app must handle BOTH flows:

```
Login initiated from?
  |
  +-- Your app (SP-initiated)
  |   User → Your login page → getAuthorizationUrl() → IdP → Callback
  |   Status: Handled by Steps 4-5
  |
  +-- IdP portal (IdP-initiated)
      User → IdP portal → Callback (no state parameter)
      TRAP: State verification will fail - handle missing state
```

**IdP-initiated trap:** Callback receives no `state` parameter. Modify Step 5 handler:

```javascript
if (!state && code) {
  // IdP-initiated - skip state verification
  const profile = await workos.sso.getProfileAndToken({ code, clientId });
  // Proceed to session creation
}
```

## Step 7: Guest Email Domain Handling

Users may authenticate with emails outside the org's verified domain (contractors, consultants).

**Example:** Org verified domain = `company.com`, user email = `freelancer@gmail.com`

Check fetched docs for whether your connection config needs "Allow profiles outside organization domains" enabled.

Test this scenario with WorkOS Test IdP before production.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment configured
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓" || echo "✗ API key invalid"

# 2. Authorization URL generation exists
grep -r "getAuthorizationUrl" src/ || echo "FAIL: No SSO implementation found"

# 3. Callback handler exists
grep -r "getProfileAndToken" src/ || echo "FAIL: No callback handler found"

# 4. State verification exists (CSRF protection)
grep -r "state" src/ | grep -i "verif\|check\|match" || echo "WARN: No state verification found"

# 5. Build succeeds
npm run build || echo "FAIL: Build errors"
```

**If check #4 fails:** Go back to Step 5. Missing state verification is a security vulnerability.

## Error Recovery

### "signin_consent_denied" in callback

**Cause:** User declined auth consent prompt at IdP.

**Callback receives:**
```
?error=signin_consent_denied&error_description=User%20cancelled%20the%20authentication%20request
```

**Fix:** Display user-friendly message: "Sign-in cancelled. Contact your IT admin if this was unexpected."

Do NOT retry automatically - user intentionally declined.

### "invalid_grant" error during token exchange

**Causes (in order of frequency):**
1. Authorization code already used (replay attempt)
2. Code expired (>10 min between auth and callback)
3. Redirect URI mismatch between Step 4 and Step 5

**Fix:** Check code is used exactly once. If persisting, verify redirect URI matches exactly (trailing slash matters).

### User authenticated but wrong organization

**Cause:** User has SSO connections with multiple orgs, authenticated with wrong one.

**Fix:** Add organization hint in Step 4 if you know which org the user should auth with. Do NOT rely on email domain alone for multi-org users.

## Related Skills

For frontend integration patterns:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
