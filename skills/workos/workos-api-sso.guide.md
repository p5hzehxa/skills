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

Set environment variables:
```bash
export WORKOS_API_KEY="sk_test_..."  # API key from WorkOS Dashboard
export WORKOS_CLIENT_ID="client_..."  # Client ID from WorkOS Dashboard
```

All API calls require the API key in the `Authorization` header:
```
Authorization: Bearer sk_test_...
```

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sso/get_authorization_url` | Generate authorization URL for SSO login |
| POST | `/sso/token` | Exchange authorization code for profile |
| GET | `/connections` | List all SSO connections |
| GET | `/connections/:id` | Get a single connection |
| DELETE | `/connections/:id` | Delete a connection |
| GET | `/sso/profile` | Get authenticated user profile (after token exchange) |

## Operation Decision Tree

**Choose the right endpoint for your task:**

### User Login Flow
1. **Generate authorization URL** → `GET /sso/get_authorization_url`
   - Use when: Initiating SSO login
   - Returns: URL to redirect user to identity provider
   - Requires: `provider` or `organization` or `connection`

2. **Exchange code for profile** → `POST /sso/token`
   - Use when: User returns from identity provider with authorization code
   - Returns: User profile with email, ID, raw attributes
   - Requires: `code` from redirect callback

### Connection Management
1. **List connections** → `GET /connections`
   - Use when: Displaying available SSO providers to admin
   - Supports: Pagination via `limit`, `before`, `after`
   - Filters: `organization_id`, `connection_type`

2. **Get specific connection** → `GET /connections/:id`
   - Use when: Fetching connection details for configuration
   - Returns: Connection metadata, state, domains

3. **Delete connection** → `DELETE /connections/:id`
   - Use when: Removing an SSO integration
   - Returns: 202 Accepted (async deletion)

## SSO Login Implementation Pattern

### Phase 1: Generate Authorization URL
```
GET /sso/get_authorization_url
Query parameters:
  - client_id (required)
  - redirect_uri (required)
  - state (recommended for CSRF protection)
  - provider (e.g., "GoogleOAuth", "OktaSAML") OR
  - organization (organization slug) OR
  - connection (connection ID)
```

**Decision logic for target parameter:**
- Use `provider` for: Domain-wide SSO (e.g., "Sign in with Google")
- Use `organization` for: Tenant-specific SSO (e.g., customer's Okta)
- Use `connection` for: Direct connection targeting (rare)

Redirect user to the returned `link` URL.

### Phase 2: Handle Callback
When user returns to `redirect_uri`, extract `code` and `state` from query parameters.

Verify `state` matches your CSRF token, then:

```
POST /sso/token
Body:
  - client_id
  - client_secret
  - code
  - grant_type: "authorization_code"
```

Response contains user profile:
```
{
  "profile": {
    "id": "prof_...",
    "email": "user@company.com",
    "first_name": "...",
    "last_name": "...",
    "connection_id": "conn_...",
    "organization_id": "org_...",
    "raw_attributes": { /* IdP-specific data */ }
  }
}
```

Use `profile.id` as stable user identifier. Use `profile.email` for account matching. Check `organization_id` for tenant context.

## Pagination Pattern

The `/connections` endpoint uses cursor-based pagination:

```
GET /connections?limit=10
→ Returns "listMetadata": { "after": "cursor_..." }

GET /connections?limit=10&after=cursor_...
→ Next page
```

**Pseudocode for fetching all connections:**
```
connections = []
after_cursor = null

loop:
  response = GET /connections?limit=100&after={after_cursor}
  connections.extend(response.data)
  
  if response.listMetadata.after exists:
    after_cursor = response.listMetadata.after
  else:
    break
```

## Error Code Mapping

Check fetched docs at https://workos.com/docs/reference/sso/get-authorization-url/error-codes for complete error reference.

**Common patterns:**

| Status | Error Code | Cause | Fix |
|--------|-----------|-------|-----|
| 400 | `invalid_request` | Missing required parameter | Add `client_id` or `redirect_uri` |
| 400 | `invalid_redirect_uri` | Redirect URI not configured | Add URI to WorkOS Dashboard allowlist |
| 401 | `unauthorized` | Invalid API key | Check `WORKOS_API_KEY` starts with `sk_` |
| 404 | `resource_not_found` | Connection/org doesn't exist | Verify ID is correct and active |
| 422 | `invalid_connection` | Connection inactive or deleted | Check connection state in Dashboard |

**Trap: Authorization URL generation failures**
- If `provider` is specified but organization doesn't have that connection type configured, request fails with 422
- If `organization` slug is invalid, fails with 404
- Always validate connection availability before generating auth URLs for production flows

## Rate Limits

Check fetched docs for current rate limits. Implement exponential backoff for 429 responses:

```
on 429 response:
  retry_after = response.headers["Retry-After"]  # seconds
  wait(retry_after)
  retry request
```

## Redirect URI Configuration

**CRITICAL:** Redirect URIs must be:
1. Pre-registered in WorkOS Dashboard → Redirects section
2. Exact match (no wildcard subdomain support)
3. HTTPS in production (HTTP allowed for localhost)

**Common redirect URI patterns:**
- Development: `http://localhost:3000/auth/callback`
- Production: `https://app.example.com/auth/callback`
- Multi-tenant: `https://{tenant}.example.com/auth/callback` (register each tenant)

See https://workos.com/docs/reference/sso/get-authorization-url/redirect-uri for security requirements.

## Connection States

Connections have lifecycle states. Check fetched docs for complete state definitions.

**Key states:**
- `active` — Ready for use
- `draft` — Configuration incomplete
- `inactive` — Temporarily disabled
- `validating` — Setup in progress

Only `active` connections can process login requests. Filter connection lists by state when displaying available SSO options.

## Verification Commands

### Test API Authentication
```bash
curl https://api.workos.com/connections \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "User-Agent: workos-verification/1.0"
# Expected: 200 OK with connection list
```

### Test Authorization URL Generation
```bash
curl -G https://api.workos.com/sso/authorize \
  --data-urlencode "client_id=${WORKOS_CLIENT_ID}" \
  --data-urlencode "redirect_uri=http://localhost:3000/callback" \
  --data-urlencode "provider=GoogleOAuth" \
  -H "User-Agent: workos-verification/1.0"
# Expected: 200 OK with { "link": "https://..." }
```

### Test Connection Retrieval
```bash
# First, get a connection ID from list endpoint
CONNECTION_ID=$(curl -s https://api.workos.com/connections \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  | jq -r '.data[0].id')

curl https://api.workos.com/connections/${CONNECTION_ID} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
# Expected: 200 OK with connection details
```

## SDK Integration Pattern

**For Node.js:**
```javascript
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Generate authorization URL
const authUrl = workos.sso.getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://app.example.com/callback',
  organization: 'org_123' // or provider, or connection
});

// Exchange code for profile
const { profile } = await workos.sso.getProfileAndToken({
  code: codeFromCallback,
  clientId: process.env.WORKOS_CLIENT_ID
});
```

Check fetched docs for language-specific SDK method signatures.

## Organization vs Connection vs Provider

**Use case matrix:**

| Scenario | Parameter | When to Use |
|----------|-----------|-------------|
| Consumer app (e.g., "Sign in with Google") | `provider: "GoogleOAuth"` | Any user can authenticate via Google workspace |
| B2B app with known tenant | `organization: "acme-corp"` | Acme Corp has pre-configured SSO (Okta, Azure, etc.) |
| Direct connection targeting | `connection: "conn_123"` | Rare — only when you need specific connection control |

**Decision tree:**
1. Do you know the user's organization? → Use `organization`
2. Is this a public OAuth provider (Google, Microsoft)? → Use `provider`
3. Do you have a specific connection ID? → Use `connection`

## Related Skills

- **workos-authkit-nextjs** — Drop-in SSO authentication for Next.js apps
- **workos-authkit-react** — SSO authentication components for React apps
