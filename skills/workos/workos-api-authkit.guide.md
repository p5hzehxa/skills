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

## Authentication Setup

Set these environment variables:

```bash
WORKOS_API_KEY=sk_live_...    # Starts with sk_live_ or sk_test_
WORKOS_CLIENT_ID=client_...   # Starts with client_
```

All API requests require the `Authorization: Bearer <WORKOS_API_KEY>` header.

Verify authentication works:

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organizations
```

Expect 200 response. If you get 401, check your API key starts with `sk_` and is from the correct environment (test vs live).

## Endpoint Catalog

### API Keys Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/organizations/:id/api_keys` | Create organization API key |
| GET | `/user_management/organizations/:id/api_keys` | List organization API keys |
| POST | `/user_management/api_keys/validate` | Validate API key |
| DELETE | `/user_management/api_keys/:id` | Delete API key |

### Authentication Flow

AuthKit uses the OAuth 2.0 authorization code flow. The endpoints are:

1. **Authorization URL** (browser redirect): `https://api.workos.com/user_management/authorize`
2. **Token exchange** (server-side): `POST /user_management/authenticate`
3. **User info** (after token exchange): included in authenticate response

Check fetched docs for exact parameter requirements and response schemas.

## Operation Decision Tree

### When to Use Each API Key Endpoint

**Creating organization API keys:**
- Use `POST /organizations/:id/api_keys` when giving organizations programmatic access
- Set the `name` field to help identify key purpose
- Store returned `secret` value immediately — it's only shown once

**Listing existing keys:**
- Use `GET /organizations/:id/api_keys` to show active keys in your UI
- Returns metadata only (no secrets)
- Use for key management dashboards

**Validating keys:**
- Use `POST /api_keys/validate` to check if a key is valid before using it
- Returns the associated organization ID if valid
- Use this to verify customer-provided keys

**Deleting keys:**
- Use `DELETE /api_keys/:id` for key rotation or revocation
- Immediate effect — any in-flight requests with that key will fail

### Authentication Flow Pattern

```
1. Redirect user to authorization URL with:
   - client_id (your WORKOS_CLIENT_ID)
   - redirect_uri (your callback URL)
   - state (CSRF token you generate)

2. User authenticates → WorkOS redirects back with code

3. Exchange code for tokens:
   POST /user_management/authenticate
   Body: { client_id, client_secret, code, grant_type: "authorization_code" }

4. Response contains:
   - access_token (for API calls)
   - refresh_token (for token renewal)
   - user object (profile data)
```

Use SDK methods for this flow — manual implementation has edge cases around state validation and token expiry.

## Error Code Mapping

Check fetched docs for the complete error reference. Common patterns:

**401 Unauthorized:**
- Cause: Missing or invalid API key
- Fix: Verify `Authorization: Bearer <key>` header is present and key starts with `sk_`

**403 Forbidden:**
- Cause: API key lacks permission for this operation
- Fix: Check key scope in WorkOS Dashboard → API Keys

**404 Not Found:**
- Cause: Resource ID doesn't exist (e.g., wrong organization ID)
- Fix: Verify ID format matches pattern (org_ prefix for organizations)

**429 Too Many Requests:**
- Cause: Rate limit exceeded
- Fix: Implement exponential backoff (start with 1s delay, double on each retry)

**5xx Server Errors:**
- Cause: WorkOS service issue
- Fix: Retry with exponential backoff (max 3 attempts)

For authentication-specific errors (invalid_client, invalid_grant, etc.), see https://workos.com/docs/reference/authkit/authentication-errors

## Pagination Handling

List endpoints (e.g., `GET /organizations/:id/api_keys`) use cursor-based pagination:

```
GET /organizations/:id/api_keys?limit=10&after=cursor_abc123
```

Response structure:
```
{
  "data": [...],
  "list_metadata": {
    "after": "cursor_xyz789"  // Use this for next page
  }
}
```

Pseudocode pattern:
```
cursor = null
all_keys = []

while true:
  response = fetch_keys(organization_id, after=cursor)
  all_keys.extend(response.data)
  
  cursor = response.list_metadata.get("after")
  if not cursor:
    break
```

## Runnable Verification

### Test API Key Creation

```bash
ORG_ID="org_01234567890abcdef"  # Replace with real org ID

curl -X POST "https://api.workos.com/user_management/organizations/$ORG_ID/api_keys" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key"}'
```

Expect 201 response with `secret` field. Save the secret — you can't retrieve it again.

### Test API Key Validation

```bash
# Use the secret from previous step
TEST_SECRET="sk_org_..."

curl -X POST "https://api.workos.com/user_management/api_keys/validate" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"$TEST_SECRET\"}"
```

Expect 200 response with organization ID if valid.

### Test Authentication Flow (SDK Required)

Manual OAuth testing is error-prone. Use the SDK method for authentication:

```javascript
// Node.js example pattern
const { code } = req.query;  // From redirect callback

const { user, accessToken } = await workos.userManagement.authenticateWithCode({
  code,
  clientId: process.env.WORKOS_CLIENT_ID,
});

// user object contains profile data
// accessToken is for API calls on behalf of user
```

Verify by checking the `user` object contains expected fields (id, email, firstName, etc.).

## Rate Limit Guidance

AuthKit API has rate limits per API key. Check fetched docs for current limits.

When you hit 429:
1. Extract `Retry-After` header (seconds to wait)
2. If no header, use exponential backoff: 1s, 2s, 4s
3. Max 3 retries, then fail with user-facing error

Pseudocode pattern:
```
max_retries = 3
delay = 1

for attempt in range(max_retries):
  response = make_request()
  
  if response.status == 429:
    wait_time = response.headers.get("Retry-After", delay)
    sleep(wait_time)
    delay *= 2
    continue
  
  return response

throw RateLimitExceeded()
```

## Common Traps

**Trap: Storing API key secrets in database**
- Organization API key secrets (starting with `sk_org_`) are shown ONCE at creation
- If you need to retrieve them later, you must store them securely at creation time
- Alternatively, delete and regenerate the key

**Trap: Using test keys in production**
- Test keys (`sk_test_`) only work with test environment users
- Live keys (`sk_live_`) required for production
- Verify environment match in WorkOS Dashboard

**Trap: Hardcoding redirect_uri**
- OAuth redirect_uri must be registered in WorkOS Dashboard → Redirects
- localhost URLs work for development, but require exact port match
- Use environment variables to handle dev vs production URLs

**Trap: Not validating state parameter**
- The `state` parameter in OAuth prevents CSRF attacks
- Generate a random value, store in session, validate on callback
- Mismatch = potential attack, reject the request

## Related Skills

- **workos-authkit-base** — Feature overview and integration concepts
- **workos-authkit-nextjs** — Next.js-specific implementation
- **workos-authkit-react** — React implementation patterns
