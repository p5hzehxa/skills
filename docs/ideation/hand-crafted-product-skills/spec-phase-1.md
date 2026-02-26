# Spec: SSO Hand-Crafted Skill

**Template**: ./spec-template-product-skill.md
**Contract**: ./contract.md
**Estimated Effort**: S

## Inputs

- Product: Single Sign-On
- File: `plugins/workos/skills/workos/references/workos-sso.guide.md`
- Doc URLs: https://workos.com/docs/sso/login-flows, https://workos.com/docs/sso/test-sso, https://workos.com/docs/sso/redirect-uris, https://workos.com/docs/sso/launch-checklist
- Eval cases: `scripts/eval/cases/sso.yaml` (3 cases: basic, org-level, IdP-initiated)

## Product-Specific Content

### Primary Decision Tree (Step 3): "How to identify the user's organization"

This is the #1 decision SSO implementors face. The eval showed Claude sometimes picks the wrong parameter.

```
How does your app identify which SSO connection to use?
  |
  +-- User enters email on login page
  |     → Use domainHint parameter (email domain → org mapping)
  |     → WorkOS resolves domain to org automatically
  |
  +-- User picks org from dropdown/list
  |     → Use organization parameter with org_id
  |     → Get org_id from your database
  |
  +-- Direct link from admin panel
  |     → Use connection parameter with conn_id
  |     → Useful for "Connect SSO" buttons
  |
  +-- Social login (Google, Microsoft)
        → Use provider parameter ('GoogleOAuth', 'MicrosoftOAuth')
        → No org/connection needed
```

**Trap:** Do NOT combine `domainHint` + `organization` — use ONE. The eval showed Claude sometimes passes both.

### Primary Code Example (Step 4): Authorization URL + Callback

```
// 1. Generate authorization URL
auth_url = workos.sso.getAuthorizationUrl({
  clientId: WORKOS_CLIENT_ID,
  redirectUri: "https://yourapp.com/callback",
  state: crypto_random_string,      // CSRF protection
  organization: org_id              // OR domainHint OR connection OR provider
})
// Redirect user to auth_url

// 2. Handle callback
callback_handler(request):
  if request.query.state AND request.query.state != session.stored_state:
    return error("Invalid state - possible CSRF")

  if request.query.error:
    return handle_sso_error(request.query.error, request.query.error_description)

  profile = workos.sso.getProfileAndToken({ code: request.query.code })
  // profile.id, profile.email, profile.organizationId, profile.connectionId
  create_session(profile)
```

### Secondary Pattern (Step 5): IdP-Initiated Flow Trap

**This is the #1 trap from eval data.** Claude's without-skill output consistently rejects IdP-initiated requests.

The callback MUST handle requests where `state` is empty (IdP-initiated flow sends `state=""`, not missing):

```
IdP-initiated handling:
  |
  +-- state is non-empty string → SP-initiated, verify against session
  +-- state is empty string ""  → IdP-initiated, skip state verification
  +-- state is missing/null     → Error, reject request
```

### Error Recovery (product-specific errors)

1. **`"Invalid state"` / `"State mismatch"`** — Callback rejects IdP-initiated requests because state is empty. Fix: make state verification conditional on non-empty state.

2. **`"invalid_grant"` / `"Code expired"`** — Authorization code used twice or took >10 min to exchange. Fix: exchange code immediately, never retry, clear stored state.

3. **`"signin_consent_denied"`** — User clicked Cancel at IdP. Fix: display friendly message ("Authentication cancelled. Contact your IT admin."), do NOT retry automatically.

4. **`"Organization not found"`** — Email domain doesn't match any org. Fix: verify domain in Dashboard, check guest domain setting.

### Verification Commands

```bash
# 1. SSO implementation exists
grep -r "getAuthorizationUrl" src/ || echo "FAIL: No SSO auth URL generation"

# 2. Callback handles error parameter
grep -r "error" src/ | grep -i callback | grep -v node_modules || echo "FAIL: No error handling in callback"

# 3. State verification exists
grep -r "state" src/ | grep -i "verify\|match\|compare\|==\|===" | grep -v node_modules || echo "FAIL: No state verification"

# 4. Env vars configured
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ API key" || echo "✗ missing"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ Client ID" || echo "✗ missing"
```

## Deviations from Template

- Step 5 is specifically about IdP-initiated flow (the eval's biggest trap signal)
- Code example shows BOTH authorization URL generation AND callback (two halves of SSO flow)
- Error recovery has 4 sections (most products need 3) because SSO has distinct error codes

## Validation

```bash
wc -c plugins/workos/skills/workos/references/workos-sso.guide.md  # Target: 3000-5000 bytes
bun run eval -- --product=sso --no-cache  # Target: delta ≥ 0% (was -5% before fixes, +1% after)
```
