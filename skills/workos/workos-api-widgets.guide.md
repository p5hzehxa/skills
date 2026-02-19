<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Overview

The Widgets API generates time-limited tokens that grant user access to embedded WorkOS UI components. This is a single-endpoint API focused on token generation.

## Prerequisites

- `WORKOS_API_KEY` (starts with `sk_`) — your secret API key
- `WORKOS_CLIENT_ID` (starts with `client_`) — your WorkOS application ID
- WorkOS SDK installed (or direct HTTP client for REST calls)

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/widgets/token` | Generate a widget token for a specific user |

## Authentication Setup

Include your API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

All requests require this header. Do NOT expose `WORKOS_API_KEY` in client-side code.

## Operation Decision Tree

**When to call `/widgets/token`:**

1. User logs into your application → generate token for authenticated session
2. User navigates to profile/settings page → generate fresh token if current one expired
3. Widget session expires (default 5 minutes) → generate new token on demand

**Token generation pattern:**
- Call POST `/user_management/widgets/token` with `user_id` and `organization_id`
- Receive short-lived token in response
- Pass token to frontend widget component
- Widget uses token to authenticate with WorkOS-hosted UI

**Security model:**
- Generate tokens server-side only (your API key must never reach the client)
- Tokens are scoped to a single user and expire quickly
- Each widget type (profile, organization switching) may require different tokens — check fetched docs for widget-specific requirements

## Request Pattern

**Backend endpoint (server-side):**

```pseudo
POST /user_management/widgets/token
Content-Type: application/json
Authorization: Bearer {WORKOS_API_KEY}

{
  "user_id": "user_01H1234567890ABCDEFGHIJK",
  "organization_id": "org_01H1234567890ABCDEFGHIJK"
}
```

**Response structure:**
Check fetched docs for exact response schema. Expect a `token` field with a time-limited JWT.

**Frontend integration:**
Pass the token to your widget component. The widget handles all communication with WorkOS using this token. Never include your API key in frontend code.

## SDK Usage Pattern

**Node.js example:**

```javascript
// Server-side route
const workos = new WorkOS(process.env.WORKOS_API_KEY);

const token = await workos.userManagement.getWidgetToken({
  user: userId,
  organization: organizationId
});

res.json({ token }); // Send to frontend
```

Check fetched docs for exact method signature in your SDK version.

## Error Code Mapping

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is set in environment |
| 403 | API key lacks permissions | Check Dashboard → API Keys → verify key has User Management scope |
| 404 | `user_id` or `organization_id` not found | Verify IDs exist in WorkOS Dashboard → Users/Organizations |
| 422 | Malformed request body | Check JSON structure matches fetched docs schema |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay, double on each retry) |
| 500 | WorkOS service error | Retry with exponential backoff; check WorkOS status page |

**Common pitfall:** Passing `user_id` without `organization_id` when the widget requires organization context. Check fetched docs for which parameters are required for each widget type.

## Rate Limit Guidance

Check fetched docs for current rate limits. If you hit 429 responses:

1. Implement exponential backoff (1s → 2s → 4s → 8s)
2. Cache tokens on your backend until they expire (default 5 minutes)
3. Avoid generating new tokens on every page load — reuse unexpired tokens

## Token Lifecycle

1. Generate token server-side via API/SDK call
2. Token is valid for ~5 minutes (check fetched docs for exact TTL)
3. Pass token to frontend widget component
4. Widget automatically refreshes if user session is active
5. On token expiration, widget will require new token from your backend

**Do NOT:** Store tokens in localStorage or cookies — they're short-lived and should be fetched on demand.

## Runnable Verification

**Test token generation (bash):**

```bash
curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_01H1234567890ABCDEFGHIJK",
    "organization_id": "org_01H1234567890ABCDEFGHIJK"
  }'
```

Replace `user_id` and `organization_id` with real IDs from your WorkOS Dashboard.

**Expected response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Test with SDK:**

```javascript
const workos = new WorkOS(process.env.WORKOS_API_KEY);

try {
  const token = await workos.userManagement.getWidgetToken({
    user: 'user_01H1234567890ABCDEFGHIJK',
    organization: 'org_01H1234567890ABCDEFGHIJK'
  });
  console.log('Token generated:', token);
} catch (error) {
  console.error('Token generation failed:', error.message);
}
```

## Verification Checklist

- [ ] `WORKOS_API_KEY` set in environment (starts with `sk_`)
- [ ] `WORKOS_CLIENT_ID` set in environment (starts with `client_`)
- [ ] Test user and organization exist in WorkOS Dashboard
- [ ] Backend endpoint generates token successfully (curl test passes)
- [ ] Token is passed to frontend without exposing API key
- [ ] Widget component receives and uses token correctly
- [ ] 401/403 errors are handled with user-friendly messages

## Common Integration Patterns

**Pattern 1: On-demand token generation**
```pseudo
// Frontend requests token when mounting widget
fetch('/api/widget-token', {
  method: 'POST',
  headers: { Authorization: userSessionToken }
})
→ Backend calls WorkOS API with server-side key
→ Returns token to frontend
→ Frontend passes token to widget component
```

**Pattern 2: Token caching**
```pseudo
// Backend caches tokens by user_id + organization_id
if (cachedToken && !isExpired(cachedToken)) {
  return cachedToken;
}
// Otherwise generate new token via WorkOS API
```

## Related Skills

- workos-authkit-react — embedding WorkOS authentication UI in React apps
- workos-authkit-nextjs — Next.js-specific authentication setup
