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

_These docs contain the current API surface, request/response schemas, and behavioral requirements. Check them for exact parameter names, required fields, and error codes._

## Prerequisites

- A WorkOS account with API keys (`WORKOS_API_KEY`, `WORKOS_CLIENT_ID`)
- WorkOS SDK installed (`npm install @workos-inc/node` for Node.js)
- Environment variables configured:
  - `WORKOS_API_KEY` — starts with `sk_`
  - `WORKOS_CLIENT_ID` — starts with `client_`

## Authentication Setup

All API calls require authentication via the `Authorization` header:

```
Authorization: Bearer {WORKOS_API_KEY}
```

**Verification command:**
```bash
curl https://api.workos.com/user_management/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

If this returns 401, your API key is invalid or missing required permissions.

## Endpoint Catalog

AuthKit API endpoints are organized by resource type:

### API Key Management
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations/{org_id}/api_keys` | Create API key for organization |
| GET | `/organizations/{org_id}/api_keys` | List API keys for organization |
| DELETE | `/api_keys/{api_key_id}` | Delete an API key |
| POST | `/api_keys/validate` | Validate an API key |

### Authentication
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/authorize` | Initiate OAuth flow |
| POST | `/user_management/authenticate` | Exchange code for session |
| POST | `/user_management/sessions/revoke` | Revoke session |

**Check fetched docs for complete endpoint list, including User Management and SSO endpoints.**

## Operation Decision Tree

### Creating vs Listing API Keys

**When to create a new key:**
- Programmatically provisioning organization access
- Setting up service-to-service authentication
- Implementing key rotation strategy

**When to list existing keys:**
- Audit which keys are active
- Find key ID for deletion
- Verify key creation succeeded

**Pseudocode pattern:**
```
if need_new_key:
    response = sdk.create_api_key(organization_id, name)
    store_key_securely(response.secret)  # Only returned once
else:
    keys = sdk.list_api_keys(organization_id)
    use_existing_key(keys[0].id)
```

### Authentication Flow Selection

**Use Authorization Code flow when:**
- Authenticating end users in web apps
- Need SSO integration
- Require MFA support

**Use API key authentication when:**
- Making server-to-server calls
- Background jobs or cron tasks
- Internal service communication

**Decision command:**
```bash
# For user auth: redirect to authorize URL
echo "https://api.workos.com/user_management/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=..."

# For service auth: use API key directly
curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/...
```

## Error Code Mapping

### API Key Operations

| Status Code | Cause | Fix |
|-------------|-------|-----|
| 401 | Invalid or expired API key | Verify key starts with `sk_`, check Dashboard for key status |
| 403 | Key lacks required permission | Check key scopes in WorkOS Dashboard |
| 404 | Organization or key not found | Verify organization ID format (`org_`), confirm key exists |
| 422 | Invalid request parameters | Check fetched docs for required fields and format |
| 429 | Rate limit exceeded | Implement exponential backoff, check rate limits in fetched docs |

### Authentication Errors

| Error Code | Cause | Fix |
|------------|-------|-----|
| `invalid_client` | Wrong `client_id` or `client_secret` | Verify credentials in WorkOS Dashboard |
| `invalid_grant` | Authorization code expired or already used | Codes expire after 10 minutes, must be used once |
| `invalid_redirect_uri` | Redirect URI not allowlisted | Add URI to allowed list in Dashboard |
| `access_denied` | User cancelled authentication | Handle gracefully, show re-auth option |

**For complete error reference, check:**
https://workos.com/docs/reference/authkit/authentication-errors

## Pagination Handling

AuthKit list endpoints use **before/after cursor pagination**:

**Pattern:**
```
GET /organizations/{org_id}/api_keys?limit=10&after={cursor}
```

**Response structure:**
```json
{
  "data": [...],
  "list_metadata": {
    "after": "cursor_value_for_next_page",
    "before": "cursor_value_for_previous_page"
  }
}
```

**Pseudocode for fetching all pages:**
```
def fetch_all_api_keys(org_id):
    all_keys = []
    cursor = None
    
    while True:
        response = sdk.list_api_keys(org_id, after=cursor, limit=100)
        all_keys.extend(response.data)
        
        if not response.list_metadata.after:
            break
        cursor = response.list_metadata.after
    
    return all_keys
```

Check fetched docs for exact pagination parameter names and limits.

## Rate Limiting

**Standard limits:**
- Check fetched docs for current rate limits per endpoint
- Rate limit headers returned in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

**Retry strategy for 429 responses:**
```
def call_with_retry(fn, max_retries=3):
    for attempt in range(max_retries):
        response = fn()
        if response.status != 429:
            return response
        
        wait_time = 2 ** attempt  # Exponential backoff
        sleep(wait_time)
    
    raise Exception("Rate limit exceeded after retries")
```

## Runnable Verification Commands

### Test API Key Validity
```bash
curl -X POST https://api.workos.com/api_keys/validate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "'"$WORKOS_API_KEY"'"}'
```

Expected: 200 response with `{"valid": true}`

### Test Organization Access
```bash
curl https://api.workos.com/user_management/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with organization list (may be empty)

### Test Authorization Endpoint Accessibility
```bash
curl -I "https://api.workos.com/user_management/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code"
```

Expected: 302 redirect to login page (not 404 or 500)

## Common Integration Traps

### API Key Creation
**Trap:** The API key secret is only returned once during creation. Losing it requires generating a new key.
**Fix:** Store the secret immediately in secure storage (env vars, secrets manager).

### Authorization Code Expiration
**Trap:** Authorization codes expire after 10 minutes and can only be used once.
**Fix:** Exchange codes for sessions immediately after receiving them. Do not cache codes.

### Redirect URI Mismatches
**Trap:** The redirect URI must match EXACTLY (including trailing slashes, query params).
**Fix:** Allowlist all variations in WorkOS Dashboard, or normalize URLs before redirecting.

### Session Revocation Race Conditions
**Trap:** Revoking a session doesn't immediately invalidate cached tokens.
**Fix:** Implement token refresh logic and handle 401 responses by clearing local session state.

## SDK Method Reference

**Node.js SDK:**
```javascript
const { WorkOS } = require('@workos-inc/node');
const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Check fetched docs for exact method signatures
workos.userManagement.createApiKey({ organizationId, name });
workos.userManagement.listApiKeys({ organizationId });
workos.userManagement.deleteApiKey(apiKeyId);
workos.userManagement.getAuthorizationUrl({ /* params */ });
workos.userManagement.authenticateWithCode({ code, clientId });
```

For other languages (Python, Ruby, Go), check fetched docs for equivalent SDK methods.

## Testing Checklist

- [ ] API key authentication succeeds (200 response from validate endpoint)
- [ ] Organization listing returns expected data
- [ ] API key creation returns secret (store it immediately)
- [ ] API key deletion removes key from list
- [ ] Authorization URL redirects to login page
- [ ] Code exchange returns valid session
- [ ] Invalid codes return `invalid_grant` error
- [ ] Rate limit headers appear in responses
- [ ] Pagination cursors fetch next page correctly

## Related Skills

- **workos-authkit-base** — AuthKit feature overview and setup
- **workos-authkit-nextjs** — Next.js integration patterns
- **workos-authkit-react** — React integration patterns
