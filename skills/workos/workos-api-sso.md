---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

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

## Endpoint Catalog

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/sso/authorize` | Initiate SSO flow — redirect user to IdP |
| POST | `/sso/token` | Exchange authorization code for profile + token |
| GET | `/user_management/users/{id}/sso_profile` | Fetch user's SSO profile after authentication |
| GET | `/connections` | List all SSO connections for an organization |
| GET | `/connections/{id}` | Retrieve a single SSO connection by ID |
| DELETE | `/connections/{id}` | Remove an SSO connection |
| GET | `/sso/logout` | Initiate IdP-initiated logout |

Check fetched docs for complete endpoint list and any new additions.

## Authentication Setup

All SSO API calls require a Bearer token in the Authorization header:

```
Authorization: Bearer sk_live_...
```

- Use `WORKOS_API_KEY` (starts with `sk_`) for server-side calls
- NEVER expose this key in client-side code
- For front-end flows, use AuthKit or redirect patterns (see workos-authkit-* skills)

Verify your key has SSO permissions in WorkOS Dashboard → API Keys.

## Operation Decision Tree

### Starting an SSO login

**Use:** `GET /sso/authorize` with redirect

**When:** User clicks "Sign in with SSO" or you detect their email domain maps to an SSO connection

**Parameters:**
- `client_id` — your WorkOS application ID (`WORKOS_CLIENT_ID`)
- `redirect_uri` — where to send user after IdP authentication
- `organization` OR `connection` OR `provider` — target for authentication

**Decision path:**
```
IF you know organization ID → use organization={org_id}
ELSE IF you know connection ID → use connection={conn_id}
ELSE IF only provider known → use provider={okta|google|microsoft}
```

Check fetched docs for full parameter schema and domain hint patterns.

### Completing SSO authentication

**Use:** `POST /sso/token` (backend only)

**When:** IdP redirects back to your `redirect_uri` with `?code=...`

**Flow:**
1. Extract `code` from query params
2. POST to `/sso/token` with `client_id`, `client_secret`, `code`
3. Response contains `access_token` and user profile
4. Create session in your app using returned profile

Check fetched docs for exact token response schema.

### Managing connections

| Task | Endpoint | Notes |
| ---- | -------- | ----- |
| List connections for org | `GET /connections?organization_id={id}` | Paginated — see below |
| Get single connection | `GET /connections/{conn_id}` | Returns full connection config |
| Delete connection | `DELETE /connections/{conn_id}` | Irreversible — confirm org first |

**Trap:** Connection creation happens via WorkOS Dashboard or Admin Portal, NOT via API. Do not attempt to POST new connections programmatically.

## Error Code Mapping

Check fetched docs for complete error code list. Common patterns:

| Status | Error Code | Cause | Fix |
| ------ | ---------- | ----- | --- |
| 400 | `invalid_redirect_uri` | Redirect URI not registered in Dashboard | Add URI to Dashboard → Redirects |
| 400 | `organization_not_found` | Invalid organization ID | Verify org exists, check for typos |
| 401 | `unauthorized` | Missing or invalid API key | Check `Authorization: Bearer sk_...` header |
| 404 | `connection_not_found` | Connection ID doesn't exist | List connections to find valid IDs |
| 422 | `sso_required` | Organization requires SSO but no connection active | Configure connection in Dashboard first |

**Decision:** If you get `sso_required`, do NOT retry with password auth — the org enforces SSO. Redirect to `/sso/authorize` instead.

## Pagination Handling

Connection listing endpoints return paginated results:

**Pattern:**
```
GET /connections?limit=10&after={cursor}
```

**Response structure:**
- `data[]` — array of connections
- `list_metadata.after` — cursor for next page (null if last page)

**Loop pattern:**
```
cursor = null
all_connections = []

LOOP:
  response = GET /connections?after={cursor}&limit=50
  all_connections.append(response.data)
  cursor = response.list_metadata.after
  IF cursor == null: BREAK
```

Check fetched docs for default and maximum page sizes.

## Runnable Verification

### Test API key authentication

```bash
curl https://api.workos.com/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 with `{"data": [...]}`. If 401, key is invalid.

### Test authorization URL generation

Using WorkOS SDK (Node.js example pattern):

```javascript
// Pseudocode — check fetched docs for exact SDK method signature
const authUrl = workos.sso.getAuthorizationUrl({
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: 'https://yourapp.com/callback',
  organization: 'org_123...'
});

console.log(authUrl); // Should start with https://api.workos.com/sso/authorize
```

### Verify connection exists before SSO flow

```bash
# List connections for org
curl "https://api.workos.com/connections?organization_id=org_123..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Expected: data array with at least one connection
# If empty array, configure SSO in Dashboard first
```

## Rate Limit Guidance

WorkOS enforces rate limits per API key. Check fetched docs for current limits.

**Pattern on 429 response:**
1. Read `Retry-After` header (seconds to wait)
2. Implement exponential backoff: wait, then retry with 2x delay on repeated 429s
3. For user-facing flows (authorize redirects), show "Try again" rather than auto-retry

**Trap:** Do NOT retry 4xx errors (except 429) — these indicate client errors that won't resolve by retrying.

## Related Skills

- **workos-authkit-nextjs** — Pre-built SSO flows for Next.js applications
- **workos-authkit-react** — React components for SSO authentication
- **workos-authkit-base** — Framework-agnostic SSO integration patterns

For higher-level integration guidance, see these feature skills first before dropping to raw API calls.
