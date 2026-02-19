<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## What Widgets API Does

The Widgets API generates short-lived tokens for embedded UI components. Use this when you need users to manage their own settings (profile, MFA, SSO connections) within your application without building custom UIs.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/widgets/token` | Generate a token for a specific widget type |

Check fetched docs for authentication requirements and base URL.

## Operation Decision Tree

**When to use Widgets API:**
- Embed profile management → generate token with `type: "profile"`
- Embed MFA enrollment → generate token with `type: "mfa_enrollment"`
- Embed SSO connection setup → generate token with `type: "sso_connection"`

**Token lifespan:**
- Tokens expire quickly (check fetched docs for exact TTL)
- Generate a new token for each widget render
- Do NOT cache tokens across sessions

## Authentication Setup

Set environment variables:
```bash
export WORKOS_API_KEY="sk_..."
export WORKOS_CLIENT_ID="client_..."
```

Include API key in request headers:
```
Authorization: Bearer sk_...
```

Verify your setup:
```bash
curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H7ZGXFP5C6BBQY6Z7277ZCT0",
    "widget_type": "profile",
    "organization_id": "org_01H7ZGXFP5C6BBQY6Z7277ZCT0"
  }'
```

Expected response structure (check fetched docs for complete schema):
```
{
  "token": "wgt_...",
  "expires_at": "..."
}
```

## SDK Implementation Pattern

The SDK provides a method to generate widget tokens. Check fetched docs for exact method signature in your language.

**Pseudocode pattern:**
```
token = workos.widgets.generateToken({
  userId: "user_01...",
  widgetType: "profile", // or "mfa_enrollment", "sso_connection"
  organizationId: "org_01..." // optional, required for SSO widgets
})
```

Pass the generated token to your frontend widget component. The widget library handles rendering and API calls internally.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 400 | Invalid `user_id` or `widget_type` | Check fetched docs for valid widget types; verify user exists |
| 404 | User or organization not found | Confirm IDs match existing WorkOS resources |
| 422 | Missing required field (e.g., `organization_id` for SSO widget) | Check fetched docs for required fields per widget type |
| 429 | Rate limit exceeded | Implement exponential backoff; check Dashboard for rate limits |

**Debugging checklist:**
1. Verify API key format: `sk_live_*` (production) or `sk_test_*` (development)
2. Confirm `user_id` format: `user_*` prefix
3. Confirm `organization_id` format: `org_*` prefix (when required)
4. Check widget type is one of the supported types (see fetched docs)

## Widget Types and Context

**Profile widget (`profile`):**
- Allows users to update their own profile information
- Does NOT require `organization_id`

**MFA enrollment widget (`mfa_enrollment`):**
- Allows users to enroll in multi-factor authentication
- Does NOT require `organization_id`

**SSO connection widget:**
- Allows organization admins to configure SSO
- REQUIRES `organization_id`
- Check fetched docs for exact widget type name and required scopes

## Integration Pattern

**Backend flow:**
1. User requests to view/edit their profile
2. Your backend generates a widget token via POST `/user_management/widgets/token`
3. Return token to frontend (token is safe to expose to authenticated users)
4. Frontend initializes widget with token

**Frontend flow (pseudocode):**
```
// Initialize widget with generated token
widget.init({
  token: "wgt_...",
  container: "#widget-container"
})

// Widget handles all UI and API calls
// No additional API calls required from your app
```

## Security Considerations

- **Token scope:** Each token is tied to a specific user and widget type. It cannot be used for other users or widget types.
- **Token expiry:** Tokens are short-lived. Generate a new token each time the user opens the widget.
- **User verification:** Generate tokens only for authenticated users in your application. Do NOT allow token generation for arbitrary user IDs.

## Verification Commands

**Test token generation:**
```bash
# Replace with your actual values
USER_ID="user_01H7ZGXFP5C6BBQY6Z7277ZCT0"
WIDGET_TYPE="profile"

curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"widget_type\": \"$WIDGET_TYPE\"
  }" | jq
```

**Expected success indicators:**
- HTTP 200 response
- Response contains `token` field starting with `wgt_`
- Response contains `expires_at` timestamp

## Common Pitfalls

1. **Caching tokens:** Do NOT reuse tokens across multiple widget renders. Generate fresh tokens each time.
2. **Missing organization_id:** SSO widgets require `organization_id`. Profile and MFA widgets do not.
3. **Exposing API key:** Use API key server-side only. Frontend receives the generated token, not the API key.
4. **Wrong widget type:** Check fetched docs for supported widget types. Typos in widget type will return 400.

## Related Skills

- workos-authkit-react — Integrate AuthKit authentication in React applications
- workos-authkit-nextjs — Integrate AuthKit authentication in Next.js applications
