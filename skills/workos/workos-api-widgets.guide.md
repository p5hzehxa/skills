<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

These docs contain the current authentication requirements, token expiration rules, and error response schemas.

## What is the Widgets API?

The Widgets API generates short-lived tokens that authorize end users to access WorkOS-hosted UI components (admin portal, user profile management, etc.). Your backend generates tokens, your frontend consumes them.

**Architecture pattern**: Token vending machine. Your server acts as a trusted intermediary that decides WHO can access WHICH widget.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/widgets/token` | Generate a short-lived widget access token |

This API has exactly one endpoint. Its power comes from the context you embed in tokens (organization ID, user claims, permissions).

## Authentication Setup

All requests require your WorkOS API key in the Authorization header:

```bash
Authorization: Bearer sk_test_...
```

**Environment variable pattern**:
```bash
export WORKOS_API_KEY=sk_test_yourkeyhere
```

Verify your key works before integrating:
```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "org_01H...", "user_id": "user_01H..."}'
```

If you see `401 Unauthorized`, your key is missing or invalid. If you see `400 Bad Request`, your key works but the payload is malformed.

## Operation Decision Tree

**When to call POST /widgets/token**:
- User clicks "Open Admin Portal" → generate token scoped to their organization
- User opens "Profile Settings" → generate token scoped to their user ID
- Embedding a widget in an iframe → generate token with appropriate claims

**Token scope decisions**:
- Include `organization_id` if the widget operates on organization-level resources (directory sync settings, SSO config)
- Include `user_id` if the widget operates on user-level resources (MFA enrollment, profile updates)
- Include both if the widget needs mixed context (e.g., user managing their org's settings)

Check fetched docs for the complete list of supported claim types and widget-specific requirements.

## Request Pattern

### Generate Widget Token

**Pseudocode**:
```javascript
// Backend route: POST /api/widget-token
const token = await workos.widgets.getToken({
  organization_id: sessionOrgId,  // from authenticated user session
  user_id: sessionUserId,          // from authenticated user session
  // Additional claims — check fetched docs for widget-specific options
})

return { token: token.token }  // Send to frontend
```

**Frontend consumption**:
```javascript
// Use the token to initialize widget
const widgetUrl = `https://workos.com/widgets/admin-portal?token=${token}`
// Open in iframe, modal, or new tab
```

**Security trap**: NEVER generate tokens client-side. Tokens grant access to sensitive operations — they MUST originate from your authenticated backend.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Missing required claim (organization_id or user_id) | Check fetched docs for which claims are required for your widget type |
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and exists in Dashboard |
| 403 | API key lacks permission for Widgets API | Check key permissions in WorkOS Dashboard → API Keys |
| 404 | Organization or user ID not found | Verify the ID exists and is spelled correctly (case-sensitive) |
| 429 | Rate limit exceeded | Implement exponential backoff starting at 1s delay |
| 500 | WorkOS service error | Retry with exponential backoff; check status.workos.com |

**Error response structure** — check fetched docs for exact schema, but expect:
```json
{
  "error": "error_code_here",
  "error_description": "Human-readable explanation"
}
```

## Token Lifecycle

1. **Generation**: Your backend calls POST /widgets/token
2. **Lifetime**: Tokens expire after a short period (check fetched docs for exact TTL)
3. **Usage**: Frontend passes token to widget via URL parameter or SDK initialization
4. **Expiration**: Widget shows "Session expired" → generate new token

**No refresh mechanism exists**. When a token expires, generate a new one. Do NOT cache tokens beyond their TTL.

## Verification Commands

### 1. Test API key authentication
```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "org_01EHQMYV6MBK39QC5PZXHY59C3"}'
```

Expected: 200 OK with `{"token": "..."}` OR 404 if org doesn't exist (proves auth works)

### 2. Test missing claims
```bash
curl -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 400 Bad Request (proves validation works)

### 3. Verify token structure
```bash
TOKEN=$(curl -s -X POST https://api.workos.com/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id": "org_..."}' | jq -r .token)

echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Expected: Decoded JWT payload showing claims you embedded

## Rate Limits

Check fetched docs for current rate limit tiers. The Widgets API is typically high-volume tolerant (users request tokens frequently).

**Retry strategy**:
```javascript
async function generateTokenWithRetry(claims, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await workos.widgets.getToken(claims)
    } catch (err) {
      if (err.status === 429 && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 1000)  // Exponential backoff
        continue
      }
      throw err
    }
  }
}
```

## Dashboard Configuration

Before generating tokens:

1. Navigate to **WorkOS Dashboard → Widgets**
2. Enable the specific widget types you need (Admin Portal, User Profile, etc.)
3. Configure allowed redirect URLs if the widget redirects after completion
4. Note the widget-specific claim requirements (some require `organization_id`, others require `user_id`)

## Common Integration Patterns

### Pattern 1: Admin Portal Token
```javascript
// User clicks "Manage SSO Settings"
app.post('/api/admin-portal-token', authenticateUser, async (req, res) => {
  const token = await workos.widgets.getToken({
    organization_id: req.user.organizationId,
    user_id: req.user.id,
  })
  res.json({ token: token.token })
})
```

### Pattern 2: User Profile Token
```javascript
// User opens profile settings
app.post('/api/profile-token', authenticateUser, async (req, res) => {
  const token = await workos.widgets.getToken({
    user_id: req.user.id,
  })
  res.json({ token: token.token })
})
```

### Pattern 3: Embedded Widget with Refresh
```javascript
// Frontend detects token expiration and refreshes
async function loadWidget() {
  const { token } = await fetch('/api/widget-token').then(r => r.json())
  initializeWidget(token)
  
  // Refresh before expiration (check fetched docs for TTL)
  setTimeout(loadWidget, TOKEN_TTL_MS - 60000)  // Refresh 1min early
}
```

## Security Checklist

- [ ] Tokens are ONLY generated server-side by authenticated endpoints
- [ ] You verify user authorization BEFORE generating tokens (don't trust client claims)
- [ ] You validate organization_id belongs to the authenticated user
- [ ] You log token generation events for audit trails
- [ ] You use HTTPS for all token transmission
- [ ] You implement rate limiting on your token generation endpoints

## Related Skills

- workos-authkit-react — Integrate widgets with React-based authentication flows
- workos-authkit-nextjs — Server-side token generation patterns in Next.js API routes
