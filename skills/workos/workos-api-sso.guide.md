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

Set these environment variables:

```bash
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
```

All API requests use Bearer token authentication:

```bash
Authorization: Bearer sk_test_...
```

Verify authentication works:

```bash
curl https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with connection list (may be empty array).

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sso/connections` | List all SSO connections for an organization |
| GET | `/sso/connections/{id}` | Retrieve a specific SSO connection |
| DELETE | `/sso/connections/{id}` | Delete an SSO connection |
| GET | `/sso/authorize` | Generate authorization URL to initiate SSO flow |

Connection IDs start with `conn_`. Organization IDs start with `org_`.

## Operation Decision Tree

### When to use which endpoint

**Creating SSO connections:** Done via WorkOS Dashboard, not API. Direct users to Dashboard > SSO > Add Connection.

**Listing connections:**
- Use `GET /sso/connections` with `organization_id` filter to show an organization's connections
- Use `connection_type` filter to show only specific providers (e.g., `GoogleOAuth`, `OktaSAML`)
- Check fetched docs for complete filter list

**Getting connection details:**
- Use `GET /sso/connections/{id}` when you have a connection ID
- Use `GET /sso/connections?organization_id=X` when you need to find connections for an organization

**Initiating SSO login:**
- Use `GET /sso/authorize` to generate the authorization URL
- EITHER pass `organization_id` (if user selected their org) OR `connection_id` (if you know the exact connection)
- Never pass both — check fetched docs for parameter rules

**Deleting connections:**
- Use `DELETE /sso/connections/{id}` to remove a connection
- This is permanent — confirm before deleting

## Authorization URL Pattern

The SSO flow starts by redirecting users to a WorkOS-generated URL:

```
1. Your app calls GET /sso/authorize with:
   - client_id (your WorkOS client ID)
   - redirect_uri (your callback URL)
   - organization_id OR connection_id (never both)
   - Optional: state parameter for CSRF protection

2. WorkOS returns authorization_url

3. Redirect user to authorization_url

4. User authenticates with IdP

5. WorkOS redirects back to your redirect_uri with:
   - code parameter (exchange for profile)
   - state parameter (if you sent one)
```

Pseudocode:

```
# Generate authorization URL
params = {
  client_id: ENV['WORKOS_CLIENT_ID'],
  redirect_uri: "https://yourapp.com/auth/callback",
  organization_id: user_selected_org_id,
  state: generate_csrf_token()
}

authorization_url = workos_client.sso.get_authorization_url(params)
redirect_to(authorization_url)
```

Check fetched docs for exact SDK method signature for your language.

## Listing Connections with Filters

List all connections for an organization:

```bash
curl "https://api.workos.com/sso/connections?organization_id=org_123" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Filter by connection type:

```bash
curl "https://api.workos.com/sso/connections?connection_type=OktaSAML" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

The API returns paginated results. Check fetched docs for pagination parameters (`before`, `after`, `limit`).

## Error Code Mapping

Check https://workos.com/docs/reference/sso/get-authorization-url/error-codes for the complete error code list. Common causes:

**401 Unauthorized:**
- Cause: Invalid or missing API key
- Fix: Verify `WORKOS_API_KEY` is set and starts with `sk_`

**400 Bad Request with `invalid_redirect_uri`:**
- Cause: redirect_uri not registered in WorkOS Dashboard
- Fix: Add redirect_uri to Dashboard > Configuration > Redirect URIs

**400 Bad Request with `invalid_organization` or `invalid_connection`:**
- Cause: Organization or connection ID doesn't exist or doesn't have SSO enabled
- Fix: Verify the ID exists and has at least one active connection

**422 Unprocessable Entity:**
- Cause: Passed both `organization_id` AND `connection_id` (mutually exclusive)
- Fix: Pass only one identifier, not both

## Redirect URI Configuration

Your callback URLs must be registered in the WorkOS Dashboard before use:

1. Navigate to Dashboard > Configuration > Redirect URIs
2. Add each URI your app will use (e.g., `https://yourapp.com/auth/callback`)
3. Use exact match — `http://localhost:3000/callback` ≠ `http://localhost:3000/callback/`

Verification command:

```bash
# Test with a registered redirect_uri
curl -G "https://api.workos.com/sso/authorize" \
  -d "client_id=$WORKOS_CLIENT_ID" \
  -d "redirect_uri=https://yourapp.com/auth/callback" \
  -d "organization_id=org_123"
```

Expected: JSON with `authorization_url` field. If you get `invalid_redirect_uri` error, the URI isn't registered.

## Pagination Pattern

The `GET /sso/connections` endpoint returns paginated results:

```bash
# First page (default limit is 10)
curl "https://api.workos.com/sso/connections?organization_id=org_123&limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response includes:

```json
{
  "data": [ /* connection objects */ ],
  "list_metadata": {
    "before": "conn_xyz",
    "after": "conn_abc"
  }
}
```

Fetch next page:

```bash
curl "https://api.workos.com/sso/connections?organization_id=org_123&after=conn_abc" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Check fetched docs for `before` parameter to paginate backwards.

## Rate Limits

WorkOS APIs are rate-limited. Check fetched docs for current limits and retry strategies. Implement exponential backoff for 429 responses:

```
if response.status == 429:
  retry_after = response.headers['Retry-After']
  wait(retry_after seconds)
  retry_request()
```

## Verification Commands

Test authentication setup:

```bash
curl https://api.workos.com/sso/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP Status 200 with JSON response.

Test authorization URL generation:

```bash
curl -G "https://api.workos.com/sso/authorize" \
  -d "client_id=$WORKOS_CLIENT_ID" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "organization_id=org_123" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP Status 200 with `authorization_url` in JSON.

Test connection retrieval:

```bash
# Replace conn_123 with actual connection ID from list response
curl https://api.workos.com/sso/connections/conn_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -w "\nHTTP Status: %{http_code}\n"
```

Expected: HTTP Status 200 with connection details.

## Common Integration Traps

1. **Don't pass both `organization_id` and `connection_id`** — the API rejects this. Choose based on your UX: org selector (use organization_id) or direct link (use connection_id).

2. **Don't hardcode redirect URIs** — use environment variables so you can register different URIs per environment (localhost for dev, production domain for prod).

3. **Don't skip state parameter** — use it for CSRF protection. Generate a random token, store it in session, verify it matches when user returns.

4. **Don't assume connections exist** — always handle empty arrays from list endpoint. An organization may have SSO configured in Dashboard but no active connections yet.

5. **Connection deletion is immediate** — there's no soft delete or undo. Confirm with user before calling DELETE.

## Related Skills

- workos-authkit-nextjs — Full authentication implementation with SSO
- workos-authkit-react — React-specific SSO integration patterns
