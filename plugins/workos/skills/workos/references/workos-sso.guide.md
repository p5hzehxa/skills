<!-- hand-crafted -->

# WorkOS Single Sign-On — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/sso/guide
- https://workos.com/docs/sso/login-flows
- https://workos.com/docs/reference/sso/get-authorization-url
- https://workos.com/docs/sso/redirect-uris
- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/launch-checklist

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ API key" || echo "✗ missing WORKOS_API_KEY"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ Client ID" || echo "✗ missing WORKOS_CLIENT_ID"
```

Both must pass. Get values from WorkOS Dashboard > API Keys.

## Step 3: Organization Identification (Decision Tree)

Pick exactly ONE **connection selector** parameter for `getAuthorizationUrl`. These are mutually exclusive — passing more than one causes an error.

```
How does your app identify which SSO connection to use?
  |
  +-- User enters email → organization: "org_01H..."
  |     YOUR app maps email domain to org_id (from your DB or
  |     WorkOS Organizations API). WorkOS does NOT auto-resolve.
  |
  +-- User picks org from dropdown → organization: "org_01H..."
  |     Store org_id per tenant in your database
  |
  +-- Direct link from admin panel → connection: "conn_01H..."
  |
  +-- Social login (Google, Microsoft) → provider: "GoogleOAuth"
```

The three connection selectors: `connection`, `organization`, `provider`. Exactly one required.

**Optional UX params** (not selectors): `domain_hint` pre-fills the domain field for Microsoft OAuth / Google SAML. `login_hint` pre-fills the email field. Neither routes the request — they only improve UX.

**Trap:** Do NOT combine connection selectors — use exactly ONE of `connection`, `organization`, or `provider`.

## Step 4: Authorization URL + Callback Handler

```
// 1. Generate authorization URL
auth_url = workos.sso.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: crypto_random_string,       // CSRF protection — store in session
  organization: org_id               // OR connection OR provider — exactly ONE (Step 3)
})
// Redirect user to auth_url

// 2. Handle callback at redirectUri
callback_handler(request):
  code = request.query.code
  state = request.query.state

  if request.query.error:
    return handle_sso_error(request.query.error, request.query.error_description)

  // Verify state — see Step 5 for IdP-initiated exception
  if state != "" AND state != session.stored_state:
    return error("Invalid state - possible CSRF")

  // Exchange code IMMEDIATELY — codes expire in 10 min
  profile = workos.sso.getProfileAndToken({ code: code })
  // profile.id, profile.email, profile.organizationId
  create_session(profile)
```

### Ruby Quick Checklist

For Ruby on Rails using the `workos` gem:

1. Configure API key

```
require "workos"
WorkOS.key = ENV["WORKOS_API_KEY"]
```

2. Generate authorization URL (one selector: `organization` | `connection` | `provider`)

```
auth_url = WorkOS::SSO.authorization_url(
  client_id: ENV["WORKOS_CLIENT_ID"],
  redirect_uri: callback_url,
  provider: "GoogleOAuth",      # or: organization: "org_..." / connection: "conn_..."
  state: SecureRandom.hex(16)    # store in session for CSRF
)
redirect_to auth_url
```

3. Handle callback, verify state (skip only if state == ""), then exchange code

```
def callback
  if params[:error]
    return render status: 400, plain: params[:error]
  end

  if params[:state].present? && params[:state] != session[:state]
    return render status: 400, plain: "Invalid state"
  end

  profile = WorkOS::SSO.profile_and_token(code: params[:code])
  session[:user_id] = profile["id"]
  redirect_to dashboard_path
end
```

## Step 5: IdP-Initiated Flow (Critical Trap)

When users click your app tile in their IdP portal (Okta, Azure AD), the callback receives `state=""` (empty string, not missing). **If you always require state verification, IdP-initiated flow breaks with "Invalid state".**

```
State parameter in callback:
  |
  +-- non-empty string → SP-initiated, verify against session
  +-- empty string ""  → IdP-initiated, skip verification
  +-- missing/null     → Malformed request, reject
```

The code in Step 4 already handles this: `if state != "" AND state != session.stored_state`.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. SSO auth URL generation exists
grep -r "getAuthorizationUrl" src/ || echo "FAIL: No SSO authorization URL generation"

# 2. Callback exchanges code for profile
grep -r "getProfileAndToken" src/ || echo "FAIL: No code-to-profile exchange in callback"

# 3. State verification exists (CSRF protection)
grep -r "state" src/ | grep -iv "node_modules" | grep -i "verify\|match\|compare\|===\|!==" || echo "FAIL: No state verification"

# 4. Env vars configured
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ API key" || echo "✗ missing"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ Client ID" || echo "✗ missing"
```

## Error Recovery

### "Invalid state" / "State mismatch"

**Cause:** Callback rejects IdP-initiated requests because `state` is empty string.
**Fix:**

1. Make state verification conditional: only verify when `state != ""`
2. When state is empty string, skip verification and proceed to code exchange
3. See Step 5 decision tree

### "invalid_grant" / "Code expired"

**Cause:** Authorization code used twice or took >10 min to exchange.
**Fix:**

1. Exchange code immediately in callback — never store for later
2. Never retry a code exchange (codes are single-use)
3. Verify redirect URI matches exactly (trailing slash matters)

### "signin_consent_denied"

**Cause:** User clicked Cancel at the IdP consent screen.
**Fix:**

1. Check `request.query.error` before attempting code exchange
2. Display friendly message: "Authentication cancelled. Contact your IT admin if unexpected."
3. Do NOT retry automatically — user intentionally declined

### "Organization not found"

**Cause:** Email domain doesn't match any org in WorkOS Dashboard.
**Fix:**

1. Verify domain is added to the org in Dashboard > Organizations
2. Check your app's email-to-org mapping logic — is the org_id correct?
3. For contractor emails outside org domain, enable guest domains in connection settings
