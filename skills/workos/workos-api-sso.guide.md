<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/sso
- https://workos.com/docs/reference/sso/connection
- https://workos.com/docs/reference/sso/connection/delete
- https://workos.com/docs/reference/sso/connection/get
- https://workos.com/docs/reference/sso/connection/list
- https://workos.com/docs/reference/sso/get-authorization-url
- https://workos.com/docs/reference/sso/get-authorization-url/error-codes
- https://workos.com/docs/reference/sso/get-authorization-url/redirect-uri

## Authentication Setup

Authenticate API calls using your WorkOS API key:

```bash
Authorization: Bearer sk_live_...
```

Set environment variables:
- `WORKOS_API_KEY` — starts with `sk_test_` or `sk_live_`
- `WORKOS_CLIENT_ID` — starts with `client_`

Verify authentication setup:

```bash
curl https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected response: 200 OK with connection list or empty array.

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sso/authorize` | Generate authorization URL to initiate SSO login |
| GET | `/sso/profile` | Exchange authorization code for user profile |
| GET | `/sso/connections` | List SSO connections for an organization |
| GET | `/sso/connections/:id` | Get details of a specific connection |
| DELETE | `/sso/connections/:id` | Delete an SSO connection |

## Operation Decision Tree

**Which endpoint do I need?**

```
├─ Initiate SSO login?
│  └─ GET /sso/authorize
│     ├─ Have organization ID? → provider=oauth&organization=org_123
│     ├─ Have connection ID? → connection=conn_123
│     └─ Have domain? → provider=oauth&domain=company.com
│
├─ Complete SSO login (exchange code)?
│  └─ GET /sso/profile with code parameter
│
├─ Manage connections programmatically?
│  ├─ List all → GET /sso/connections?organization_id=org_123
│  ├─ Get one → GET /sso/connections/:id
│  └─ Delete → DELETE /sso/connections/:id
│
└─ Configure SSO provider (SAML/OIDC)?
   └─ Use WorkOS Dashboard — API is read-only for connection CRUD
```

**Key decision: Authorization URL strategy**

- **Organization selector**: User picks from multiple connections
  - Use `provider=oauth&organization=org_123`
  - WorkOS shows connection picker UI if multiple exist
  
- **Direct connection**: Skip picker, use specific connection
  - Use `connection=conn_123`
  - Fastest flow when connection is known
  
- **Domain lookup**: Auto-match by email domain
  - Use `provider=oauth&domain=company.com`
  - WorkOS finds connection by configured domain

Check fetched docs for parameter requirements and constraints for each strategy.

## SSO Flow Pattern

### 1. Generate Authorization URL

```pseudocode
authUrl = generateAuthorizationUrl({
  provider: "oauth",
  organization: "org_123",  // or connection: "conn_123"
  redirect_uri: "https://yourapp.com/callback",
  state: generateCsrfToken()  // your CSRF token
})

redirect(authUrl)
```

The authorization URL includes:
- `client_id` — your WorkOS client ID
- `redirect_uri` — callback URL (must match Dashboard config)
- `state` — CSRF token you generate
- `organization` or `connection` or `domain` — routing parameter

### 2. Handle Callback

```pseudocode
// User redirected to: /callback?code=...&state=...

if (state !== expectedState) {
  throw "CSRF validation failed"
}

profile = exchangeCode(code)
// Returns: { id, email, first_name, last_name, ... }

session.userId = profile.id
session.email = profile.email
```

Check fetched docs for complete profile schema — fields vary by provider.

### 3. Connection Management

```pseudocode
// List connections for an organization
connections = listConnections({ organization_id: "org_123" })

// Get connection details
connection = getConnection("conn_123")
// Returns: { id, name, state, type, ... }

// Delete connection
deleteConnection("conn_123")
```

**Trap**: Connection deletion is immediate and irreversible. Connections can only be created via Dashboard, not API.

## Error Code Mapping

Check https://workos.com/docs/reference/sso/get-authorization-url/error-codes for complete list.

### Authorization URL Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_redirect_uri` | Redirect URI not configured | Add URI to Dashboard → Configuration → Redirect URIs |
| `invalid_client_id` | Wrong `WORKOS_CLIENT_ID` | Verify client ID starts with `client_` |
| `organization_not_found` | Invalid organization ID | Check organization exists and ID is correct |
| `connection_not_found` | Invalid connection ID | List connections to verify ID |
| `no_active_connection` | Organization has no active SSO | User must configure SSO in Dashboard first |

### Profile Exchange Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` |
| 400 | Invalid code parameter | Code expires after 10 minutes — regenerate authorization URL |
| 422 | Code already used | Authorization codes are single-use — initiate new flow |

### Connection API Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 404 | Connection not found | Verify connection ID is correct |
| 403 | Connection belongs to different environment | Check you're using correct API key (test vs live) |

## Pagination Handling

Connection listing supports pagination:

```bash
curl "https://api.workos.com/sso/connections?organization_id=org_123&limit=10&after=conn_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response includes:
```json
{
  "data": [...],
  "list_metadata": {
    "after": "conn_456",  // cursor for next page
    "before": null
  }
}
```

Pattern: Pass `after` value from response to `after` parameter for next page. Stop when `after` is null.

## Rate Limits

Check fetched docs for current rate limits. If you receive 429 status:
- Implement exponential backoff (start with 1s delay, double each retry)
- Cache connection lists to reduce API calls
- Use webhooks for connection state changes instead of polling

## Verification Commands

**Test API key authentication:**

```bash
curl https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nStatus: %{http_code}\n"
```

Expected: 200 status with connection array.

**Test authorization URL generation (SDK):**

```bash
# Verify SDK can generate URL without errors
node -e "
const WorkOS = require('@workos-inc/node').default;
const workos = new WorkOS(process.env.WORKOS_API_KEY);
const url = workos.sso.getAuthorizationUrl({
  provider: 'oauth',
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'http://localhost:3000/callback',
  organization: 'org_123'
});
console.log('URL generated:', url);
"
```

Expected: URL starting with `https://api.workos.com/sso/authorize?`.

**Test connection retrieval:**

```bash
# Replace conn_123 with real connection ID from Dashboard
curl https://api.workos.com/sso/connections/conn_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq .
```

Expected: 200 status with connection object containing `id`, `name`, `state`, `type`.

## Redirect URI Configuration

**Trap**: Authorization will fail if redirect URI isn't pre-configured.

Before calling `/sso/authorize`, add redirect URIs in Dashboard:
1. Navigate to Configuration → Redirect URIs
2. Add exact callback URL (including protocol, domain, path)
3. For local development, add `http://localhost:3000/callback`
4. For production, add `https://yourapp.com/callback`

**Pattern**: Use different redirect URIs per environment:
- Development: `http://localhost:3000/callback`
- Staging: `https://staging.yourapp.com/callback`
- Production: `https://yourapp.com/callback`

Check fetched docs for redirect URI validation rules and wildcard support.

## Related Skills

- workos-authkit-react — Pre-built React components for SSO login UI
- workos-authkit-nextjs — Next.js integration with SSO middleware
- workos-authkit-vanilla-js — Vanilla JavaScript SSO implementation
