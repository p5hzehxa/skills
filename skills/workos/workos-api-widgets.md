---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/widgets/token` | Generate a client-side token for widget rendering |

## Authentication Setup

All Widgets API calls require server-side authentication using your API key:

```bash
Authorization: Bearer sk_your_api_key
```

**Environment variables:**
- `WORKOS_API_KEY` — starts with `sk_`, used server-side only
- `WORKOS_CLIENT_ID` — starts with `client_`, used for organization context

## Operation Decision Tree

**When to generate a widget token:**
- User needs to access a self-service widget (User Management, SSO configuration, etc.)
- Token must be generated server-side, passed to client
- Token is short-lived and scoped to specific widget + user context

**Token generation flow:**
1. Authenticate user in your application
2. Call POST `/widgets/token` from your backend with user context
3. Return token to frontend
4. Frontend uses token to initialize widget

## Token Generation Pattern

Generate tokens server-side only — never expose your API key to the client.

**Pseudocode:**
```
POST /widgets/token
Headers: Authorization: Bearer {WORKOS_API_KEY}
Body: {
  organization_id: "org_xyz",
  user_id: "user_123",  // your application's user ID
  widget_scope: "specific_widget_type"
}

Response: {
  token: "wgt_token_...",
  expires_at: timestamp
}
```

Check fetched docs for exact widget scope values and optional parameters.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is set in environment |
| 403 | API key lacks permissions | Check Dashboard → API Keys → ensure key has widgets access |
| 404 | Organization ID not found | Verify `organization_id` exists in your WorkOS environment |
| 422 | Invalid widget scope or parameters | Check fetched docs for valid scope values |
| 429 | Rate limit exceeded | Implement exponential backoff, cache tokens when possible |

**Common trap:** Calling token endpoint from frontend. Token generation MUST happen server-side.

## Token Lifecycle Management

**Token expiration:** Tokens are short-lived (check fetched docs for exact TTL). Generate a fresh token for each widget session — do NOT cache across sessions.

**Token reuse:** Within a single session, reuse the same token until expiration. Generate new token only when current one expires or user context changes.

## Rate Limit Guidance

Widget token generation is rate-limited per API key. If you hit limits:
- Cache tokens for their full lifetime
- Implement exponential backoff: retry after 1s, 2s, 4s, etc.
- For high-volume applications, request rate limit increase in Dashboard

## Verification Commands

**Test token generation:**
```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01HYZ...",
    "user_id": "user_123"
  }'
```

Expected response includes `token` field starting with `wgt_` and `expires_at` timestamp.

**Verify API key permissions:**
```bash
# Should return 200, not 403
curl -I -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Integration Checklist

- [ ] `WORKOS_API_KEY` is set in server environment (never client)
- [ ] Token generation endpoint is server-side only
- [ ] Tokens are passed to client after generation
- [ ] Error responses from WorkOS are handled and logged
- [ ] Token expiration is handled gracefully (regenerate on 401)
- [ ] Organization ID is validated before token generation

## Related Skills

- workos-authkit-base — for AuthKit widget integration patterns
- workos-authkit-react — for React-specific widget implementations
- workos-authkit-nextjs — for Next.js server-side token generation
