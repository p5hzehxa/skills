<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## What are Widgets?

Widgets are embeddable WorkOS components that handle specific user management flows (profile management, organization settings, etc.) within your application. The Widgets API generates short-lived tokens that authorize widget rendering.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/widgets/token` | Generate a widget authorization token |

## Authentication Setup

All Widgets API calls require:

```bash
Authorization: Bearer sk_yourworkosapikey
Content-Type: application/json
```

Set `WORKOS_API_KEY` in your environment — verify it starts with `sk_`.

## Operation Decision Tree

**When to use Widgets:**
- User needs to manage their profile → generate token with `profile_settings` widget type
- User needs to manage organization settings → generate token with `organization_settings` widget type
- User needs to manage SSO connections → generate token with `sso_connections` widget type

**Token generation pattern:**
1. User requests to view a widget (e.g., clicks "Edit Profile")
2. Backend calls POST `/user_management/widgets/token` with widget type + user ID
3. Backend returns token to frontend
4. Frontend renders widget using returned token

## Core Implementation Pattern

### Generate Widget Token (Pseudocode)

```
WHEN user requests widget access:
  CALL SDK method to generate widget token:
    - widget_type: "profile_settings" | "organization_settings" | "sso_connections"
    - user_id: WorkOS user identifier (starts with user_)
    - organization_id: (required for org-scoped widgets)
  
  IF success:
    RETURN token to frontend
  
  IF error:
    CHECK error code mapping below
```

**Check fetched docs for:**
- Exact SDK method signature for your language
- Complete list of supported widget types
- Required vs optional parameters per widget type

### Frontend Widget Rendering (Pseudocode)

```
WHEN backend returns token:
  LOAD WorkOS Widget SDK in frontend
  
  INITIALIZE widget:
    - token: received from backend
    - container: DOM element selector
  
  MOUNT widget in specified container
```

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 400 | Missing required field | Check fetched docs for required parameters for widget type |
| 404 | Invalid user_id or organization_id | Verify ID format (user_ or org_ prefix) and resource exists |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay) |

**Check fetched docs for:** Complete error response schema and additional error codes.

## Token Lifecycle

- Tokens are **short-lived** (check fetched docs for exact TTL)
- Generate a new token each time user accesses widget
- Do NOT cache or reuse tokens across sessions
- Token is single-use per widget mount

## Dashboard Configuration

Navigate to WorkOS Dashboard → User Management → Widgets to:
1. Enable widget types for your environment
2. Configure widget appearance (colors, logos)
3. Set redirect URLs for widget actions

**Check fetched docs for:** Complete list of configurable widget settings.

## Verification Commands

### Test token generation:

```bash
curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "widget_type": "profile_settings",
    "user_id": "user_01HXYZ..."
  }'
```

Expected response contains `token` field (JWT format).

### Verify API key format:

```bash
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "✓ Valid prefix" || echo "✗ Invalid key format"
```

## Security Considerations

1. **Never expose tokens to client-side code** before user authentication
2. **Generate tokens server-side only** — API key must not be in frontend
3. **Validate user identity** before generating token for their user_id
4. **Use HTTPS** for all token transmission

## Rate Limits

Widget token generation shares User Management API rate limits. Implement exponential backoff for 429 responses:

```
RETRY_DELAY = 1  // seconds
MAX_RETRIES = 3

ON 429 error:
  WAIT RETRY_DELAY seconds
  RETRY_DELAY = RETRY_DELAY * 2
  INCREMENT retry_count
  IF retry_count > MAX_RETRIES:
    FAIL with rate limit error
```

**Check fetched docs for:** Current rate limit values per environment.

## Integration Traps

### Common mistake: Caching tokens
**Wrong:** Store token in session/localStorage for reuse  
**Right:** Generate fresh token each time widget is opened

### Common mistake: Frontend API key exposure
**Wrong:** Call token endpoint directly from browser with API key  
**Right:** Proxy through backend route that validates user session first

### Common mistake: Missing organization_id
**Wrong:** Generate org-scoped widget token without organization_id  
**Right:** Always include organization_id for organization_settings and sso_connections widgets

## Related Skills

- workos-authkit-react — Add authentication before widget access
- workos-authkit-nextjs — Implement widget token generation in Next.js API routes
