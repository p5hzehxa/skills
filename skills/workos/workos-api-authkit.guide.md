<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization
- https://workos.com/docs/reference/authkit/api-keys/validate
- https://workos.com/docs/reference/authkit/authentication
- https://workos.com/docs/reference/authkit/authentication-errors

_2 additional doc pages available at https://workos.com/docs_

## Prerequisites

- WorkOS account with API credentials
- API key (`WORKOS_API_KEY`) starting with `sk_` prefix
- Client ID (`WORKOS_CLIENT_ID`) starting with `client_` prefix
- WorkOS SDK installed for your language

## Authentication Setup

All API requests require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

Set environment variables:
```bash
export WORKOS_API_KEY=sk_...
export WORKOS_CLIENT_ID=client_...
```

Verify credentials are loaded:
```bash
echo $WORKOS_API_KEY | grep -E '^sk_'
echo $WORKOS_CLIENT_ID | grep -E '^client_'
```

## API Endpoint Catalog

### Authentication Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/authenticate` | Authenticate user with code from callback |
| POST | `/user_management/sessions` | Create new session |
| GET | `/user_management/sessions/:id` | Retrieve session details |
| DELETE | `/user_management/sessions/:id` | Revoke session (logout) |
| POST | `/user_management/sessions/:id/refresh` | Refresh expired session |

### API Key Management Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/organizations/:org_id/api_keys` | Create API key for organization |
| GET | `/user_management/organizations/:org_id/api_keys` | List organization API keys |
| DELETE | `/user_management/api_keys/:key_id` | Delete specific API key |
| POST | `/user_management/api_keys/validate` | Validate API key is active |

## Operation Decision Tree

### When to use which authentication endpoint:

**Initial authentication (OAuth callback)**
→ Use `GET /user_management/authenticate` with `code` parameter

**Check existing session validity**
→ Use `GET /user_management/sessions/:id`

**Session expired but refresh token valid**
→ Use `POST /user_management/sessions/:id/refresh`

**User logout**
→ Use `DELETE /user_management/sessions/:id`

**Need new session without re-login**
→ Use `POST /user_management/sessions` (requires valid refresh token)

### When to use which API key endpoint:

**Generate new org-scoped API key**
→ Use `POST /user_management/organizations/:org_id/api_keys`

**Audit existing keys**
→ Use `GET /user_management/organizations/:org_id/api_keys`

**Revoke compromised key**
→ Use `DELETE /user_management/api_keys/:key_id`

**Verify key before operations**
→ Use `POST /user_management/api_keys/validate`

## Error Code Mapping

### HTTP 401 Unauthorized

**Cause**: Invalid or missing API key
**Fix**: Verify `WORKOS_API_KEY` is set and starts with `sk_`
**Verification**:
```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/sessions/session_01H1234
# Should NOT return 401
```

### HTTP 404 Not Found

**Session endpoint**: Session ID doesn't exist or was revoked
**Fix**: Check session ID format (`session_` prefix) and verify session hasn't expired

**API key endpoint**: Organization ID or key ID doesn't exist
**Fix**: Verify organization ID format (`org_` prefix) and key ID format (`api_key_` prefix)

### HTTP 422 Unprocessable Entity

**Cause**: Malformed request body or invalid parameters
**Fix**: Check fetched docs for exact request schema requirements
**Common issues**:
- Missing required `code` parameter in authenticate call
- Invalid `grant_type` in refresh request
- Missing organization ID in API key creation

### HTTP 429 Too Many Requests

**Cause**: Rate limit exceeded
**Fix**: Implement exponential backoff with jitter
**Pattern**:
```
base_delay = 1 second
max_retries = 3
retry_delay = base_delay * (2 ^ attempt) + random(0, 1000ms)
```

## Pagination Handling

AuthKit API uses cursor-based pagination for list endpoints (API keys):

**Request pattern**:
```
GET /user_management/organizations/:org_id/api_keys?limit=10&after=cursor_value
```

**Response includes**:
- `data`: array of results
- `list_metadata.after`: cursor for next page (null if no more pages)

**Fetching all pages**:
```
1. Call endpoint without 'after' parameter
2. Extract 'list_metadata.after' from response
3. If after != null, call again with after=cursor_value
4. Repeat until after == null
```

## Runnable Verification Commands

### Verify API key authentication works

```bash
curl -f -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organizations?limit=1"
# Should return 200 with organization list
```

### Verify session lookup works

```bash
# Replace session_01H1234 with actual session ID
curl -f -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/sessions/session_01H1234"
# Should return 200 with session object or 404 if not found
```

### Verify API key validation endpoint

```bash
curl -f -X POST \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "sk_test_key_to_validate"}' \
  "https://api.workos.com/user_management/api_keys/validate"
# Should return 200 with validation status
```

### Verify rate limiting behavior

```bash
for i in {1..100}; do
  curl -w "%{http_code}\n" -o /dev/null -s \
    -H "Authorization: Bearer $WORKOS_API_KEY" \
    "https://api.workos.com/user_management/organizations?limit=1"
done | grep -c "429"
# Should eventually return 429 status codes
```

## Integration Patterns

### Authentication flow pseudocode

```
# Step 1: Redirect user to WorkOS
redirect_url = get_authorization_url(
  client_id=WORKOS_CLIENT_ID,
  redirect_uri=YOUR_CALLBACK_URL
)

# Step 2: Handle callback (user returns with code)
code = extract_code_from_callback_params()
auth_response = authenticate_with_code(code)
session_id = auth_response.session_id
access_token = auth_response.access_token

# Step 3: Store session ID (in cookie, DB, etc)
set_secure_cookie("session_id", session_id)

# Step 4: Verify session on subsequent requests
session = get_session(session_id)
if session.expired:
  refresh_session(session_id)
```

### API key management pseudocode

```
# Create organization-scoped key
api_key_response = create_api_key(
  organization_id="org_01H1234",
  name="Production App Key"
)
# Store api_key_response.secret securely - shown only once

# List keys for audit
keys = list_api_keys(organization_id="org_01H1234")
for key in keys:
  log(key.name, key.created_at, key.last_used_at)

# Revoke compromised key
delete_api_key(key_id="api_key_01H5678")
```

## Common Integration Traps

### Trap 1: Using session ID as access token
**Wrong**: Pass session ID in Authorization header
**Right**: Use session ID to retrieve access token, THEN use access token for user info

### Trap 2: Not handling session refresh
**Wrong**: Treat sessions as permanent
**Right**: Check session expiry and call refresh endpoint before expiration

### Trap 3: Storing API key client-side
**Wrong**: Include `WORKOS_API_KEY` in frontend JavaScript
**Right**: API key ONLY in server-side code; frontend uses session tokens

### Trap 4: Ignoring API key rotation
**Wrong**: Create one key and use forever
**Right**: List keys periodically, delete unused keys, rotate keys on schedule

### Trap 5: Not validating code parameter
**Wrong**: Assume callback code is always present
**Right**: Check for error parameters in callback (user denied access, etc)

## Error Recovery Procedures

### Session expired during request
1. Extract session ID from request
2. Call `POST /user_management/sessions/:id/refresh`
3. If refresh succeeds, retry original request with new token
4. If refresh fails (refresh token expired), redirect to login

### API key validation fails
1. Call `POST /user_management/api_keys/validate` with key
2. If returns invalid, generate new key via `POST /user_management/organizations/:org_id/api_keys`
3. Update application configuration with new key
4. Revoke old key via `DELETE /user_management/api_keys/:key_id`

### Rate limit hit
1. Extract `Retry-After` header from 429 response (if present)
2. Wait for specified duration OR use exponential backoff
3. Retry request after delay
4. If retries exhausted, return error to user with "try again later" message

## Related Skills

- **workos-authkit-base** — Core AuthKit concepts and configuration
- **workos-authkit-nextjs** — Next.js-specific implementation patterns
- **workos-authkit-react** — React implementation patterns
