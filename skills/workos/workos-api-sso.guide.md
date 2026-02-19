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

Check fetched docs for complete request/response schemas, exact SDK method signatures for your language, rate limits, and behavioral requirements.

## Authentication Setup

All SSO API calls require authentication via API key:

```bash
# Set in environment
export WORKOS_API_KEY="sk_live_..."
export WORKOS_CLIENT_ID="client_..."

# API calls use Bearer token
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/sso/...
```

API keys start with `sk_test_` (development) or `sk_live_` (production). Verify key permissions in Dashboard → API Keys if you see 401 errors.

## Endpoint Catalog

### Authorization Flow
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sso/authorize` | Generate authorization URL for SSO login |
| POST | `/sso/token` | Exchange authorization code for user profile |

### Connection Management
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/connections` | List all SSO connections |
| GET | `/connections/:id` | Retrieve single connection details |
| DELETE | `/connections/:id` | Remove SSO connection |

## Operation Decision Tree

### When to use which endpoint:

**Initiating SSO login:**
→ Call `GET /sso/authorize` with organization, connection, or provider parameter
→ Redirect user to returned authorization URL

**Completing SSO login:**
→ User redirects back with `code` parameter
→ Call `POST /sso/token` to exchange code for profile
→ Create session using returned user data

**Managing connections:**
→ List all connections: `GET /connections`
→ Filter by organization: add `?organization_id=org_...`
→ Get connection details: `GET /connections/:id`
→ Remove connection: `DELETE /connections/:id`

**Choosing organization selector:**
→ Known organization: pass `organization=org_...` to authorize
→ Known connection: pass `connection=conn_...` to authorize
→ Generic provider: pass `provider=GoogleOAuth` to authorize
→ Unknown organization: implement organization selection UI first

## Authorization URL Generation Pattern

```pseudocode
// Step 1: Determine targeting strategy
if (user_selected_organization) {
  params.organization = organization_id
} else if (direct_connection_link) {
  params.connection = connection_id  
} else if (generic_provider) {
  params.provider = provider_slug
}

// Step 2: Generate URL
params.client_id = WORKOS_CLIENT_ID
params.redirect_uri = YOUR_CALLBACK_URL
params.state = generate_random_state_token()

authorization_url = SDK.sso.getAuthorizationURL(params)

// Step 3: Store state token for verification
session.store("sso_state", params.state)

// Step 4: Redirect
redirect(authorization_url)
```

## Callback Handling Pattern

```pseudocode
// Step 1: Verify state token
received_state = request.query.state
stored_state = session.get("sso_state")
if (received_state != stored_state) {
  throw "State mismatch - possible CSRF attack"
}

// Step 2: Check for errors
if (request.query.error) {
  // See error code mapping below
  handle_sso_error(request.query.error)
}

// Step 3: Exchange code for profile
code = request.query.code
profile = SDK.sso.getProfileAndToken({ code })

// Step 4: Create application session
user = find_or_create_user(profile.email)
session.login(user)
redirect("/dashboard")
```

## Error Code Mapping

### Authorization Errors (query parameter `error`)

Check fetched docs for complete error code list. Common patterns:

**`access_denied`**
→ User canceled login or lacks permissions
→ Show user-friendly "Login canceled" message
→ Allow retry

**`invalid_request`**
→ Missing required parameter (client_id, redirect_uri)
→ Check authorization URL generation logic
→ Verify Dashboard redirect URI configuration matches exactly

**`unauthorized_client`**
→ `WORKOS_CLIENT_ID` is invalid or disabled
→ Verify client ID in Dashboard → Configuration
→ Check environment variable is set correctly

**`server_error`**
→ Transient WorkOS API issue
→ Show "Please try again" message
→ Retry after 5 seconds

### Token Exchange Errors (API response)

**401 Unauthorized**
→ Invalid `WORKOS_API_KEY` or missing Bearer token
→ Verify key starts with `sk_` and matches environment
→ Check key is not expired in Dashboard

**400 Bad Request with `invalid_grant`**
→ Authorization code already used or expired (10 min TTL)
→ Code can only be exchanged once
→ User must restart SSO flow

**400 Bad Request with `redirect_uri_mismatch`**
→ Redirect URI in token call doesn't match authorization call
→ Use identical URI in both requests (including trailing slash)
→ Verify Dashboard configuration matches exactly

## Connection Listing Pattern

```pseudocode
// List all connections
connections = SDK.sso.listConnections()

// Filter by organization
org_connections = SDK.sso.listConnections({
  organization_id: "org_..."
})

// Filter by connection type
saml_connections = SDK.sso.listConnections({
  connection_type: "SAML"
})

// Pagination (if >100 connections)
all_connections = []
params = { limit: 100 }
do {
  page = SDK.sso.listConnections(params)
  all_connections.push(...page.data)
  params.after = page.list_metadata.after
} while (page.list_metadata.after)
```

Check fetched docs for exact pagination parameters and list_metadata structure.

## Connection Management

### Retrieve Connection Details
```bash
curl -X GET "https://api.workos.com/connections/conn_..." \
     -H "Authorization: Bearer $WORKOS_API_KEY"
```

Use to display connection status, provider type, or debug configuration issues.

### Delete Connection
```bash
curl -X DELETE "https://api.workos.com/connections/conn_..." \
     -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Warning:** Deletion is immediate and cannot be undone. Users of this connection will lose SSO access. Implement confirmation UI before calling.

## Verification Commands

### Test Authorization URL Generation
```bash
curl "https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&provider=GoogleOAuth"
```
Should return 302 redirect to Google OAuth consent screen.

### Test Token Exchange
```bash
# After completing OAuth flow and receiving code:
curl -X POST "https://api.workos.com/sso/token" \
     -H "Authorization: Bearer $WORKOS_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "client_id": "'$WORKOS_CLIENT_ID'",
       "code": "AUTHORIZATION_CODE_FROM_CALLBACK",
       "grant_type": "authorization_code"
     }'
```
Should return profile JSON with email, first_name, last_name, id.

### Test Connection Listing
```bash
curl "https://api.workos.com/connections" \
     -H "Authorization: Bearer $WORKOS_API_KEY"
```
Should return paginated list of connections.

## Rate Limits

Check fetched docs for current rate limits. If you receive 429 status:
→ Implement exponential backoff (1s, 2s, 4s, 8s)
→ Check `Retry-After` header for suggested wait time
→ Consider caching connection list data to reduce API calls

## Common Integration Traps

**Trap: Using organization parameter for generic provider login**
→ For "Sign in with Google" flows, use `provider=GoogleOAuth` NOT organization
→ Organization parameter requires user to belong to that specific org
→ Check fetched docs for provider slug list (GoogleOAuth, MicrosoftOAuth, etc.)

**Trap: Redirect URI mismatch between authorize and token calls**
→ Use IDENTICAL redirect_uri value in both endpoints
→ Include protocol, domain, path, and trailing slash exactly
→ Configure ALL redirect URIs in Dashboard → Redirects section

**Trap: State token not verified on callback**
→ Always generate random state token before authorization
→ Store in session, verify on callback
→ Prevents CSRF attacks where attacker forces login to attacker's account

**Trap: Assuming code can be reused**
→ Authorization codes expire after 10 minutes
→ Can only be exchanged once for security
→ Store profile data in session after exchange, don't re-exchange

**Trap: Deleting connection while users are logged in**
→ Existing sessions remain valid until natural expiry
→ New login attempts will fail immediately
→ Implement graceful degradation or session invalidation

## Related Skills

- **workos-authkit-nextjs** — Pre-built SSO UI components for Next.js
- **workos-authkit-react** — React components for SSO flows
- **workos-authkit-vanilla-js** — Framework-agnostic SSO implementation
