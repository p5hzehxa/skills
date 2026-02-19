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

_These docs contain the current API schemas, error codes, and behavioral requirements. Always fetch before implementing._

---

## Authentication Setup

All AuthKit API calls require authentication via API key.

**Set the API key header:**
```
Authorization: Bearer {WORKOS_API_KEY}
```

**Verify your API key format:**
- Production keys start with `sk_live_`
- Test keys start with `sk_test_`
- Never commit keys to version control — use environment variables

**Test authentication:**
```bash
curl -X GET https://api.workos.com/user_management/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

If you receive `401 Unauthorized`, check:
1. Key is correctly set in environment
2. Key has not been deleted in Dashboard → API Keys
3. No extra whitespace in key value

---

## Endpoint Catalog

AuthKit API exposes these core endpoint groups:

### Organization API Keys
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/organization_api_keys` | Create API key for an organization |
| DELETE | `/user_management/organization_api_keys/{key_id}` | Delete API key |
| GET | `/user_management/organization_api_keys` | List keys for organization |
| POST | `/user_management/organization_api_keys/validate` | Validate key signature |

### Authentication
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/sso/authorize` | Initiate SSO flow |
| POST | `/sso/token` | Exchange code for tokens |
| POST | `/user_management/authenticate` | Get user session |

Check fetched docs for complete endpoint list including directory sync, user management, and MFA endpoints.

---

## Operation Decision Tree

**When should I use which endpoint?**

### Creating Organization API Keys
```
Need to give an org programmatic access?
└─> POST /user_management/organization_api_keys
    ├─ Include organization_id in request body
    └─ Store returned key securely — it's only shown once
```

### Listing vs Validating Keys
```
Need to audit which keys exist?
└─> GET /user_management/organization_api_keys?organization_id={id}

Need to verify a key's signature?
└─> POST /user_management/organization_api_keys/validate
    └─ Send the key_id you want to validate
```

### Deleting Keys
```
Revoking access?
└─> DELETE /user_management/organization_api_keys/{key_id}
    └─ Key becomes invalid immediately
```

### Authentication Flow
```
User needs to sign in?
└─> Redirect to WorkOS-hosted AuthKit UI
    └─> User authenticates
        └─> WorkOS redirects back with code
            └─> POST /sso/token to exchange code for session
```

Check fetched docs for complete decision trees including directory sync provisioning and MFA enrollment patterns.

---

## Error Code Mapping

### Organization API Key Endpoints

**HTTP 400 Bad Request**
- **Cause:** Missing required field (e.g., `organization_id`)
- **Fix:** Check request body includes all required parameters from fetched docs

**HTTP 401 Unauthorized**
- **Cause:** Invalid or missing API key in Authorization header
- **Fix:** Verify `WORKOS_API_KEY` environment variable is set and starts with `sk_`

**HTTP 404 Not Found**
- **Cause:** Organization ID or key ID does not exist
- **Fix:** Verify IDs match resources in Dashboard → Organizations or API Keys

**HTTP 422 Unprocessable Entity**
- **Cause:** Organization already has maximum number of API keys
- **Fix:** Delete unused keys before creating new ones

**HTTP 429 Too Many Requests**
- **Cause:** Rate limit exceeded (check fetched docs for current limits)
- **Fix:** Implement exponential backoff starting at 1 second

### Authentication Endpoints

**HTTP 403 Forbidden**
- **Cause:** User does not have permission to access the requested resource
- **Fix:** Check user's role and organization membership in Dashboard → Users

**HTTP 422 Unprocessable Entity (Authentication)**
- **Cause:** Invalid authentication code or token
- **Fix:** Code may be expired (10 minute lifetime) — restart authentication flow

Check fetched docs for complete error reference including specific error codes like `invalid_grant`, `access_denied`.

---

## Pagination Handling

AuthKit list endpoints return paginated results. Use cursor-based pagination:

**Pattern:**
```
GET /user_management/organization_api_keys?organization_id={id}&limit=10

Response includes:
{
  "data": [...],
  "list_metadata": {
    "after": "cursor_string",
    "before": null
  }
}

Next page:
GET /user_management/organization_api_keys?organization_id={id}&limit=10&after=cursor_string
```

**Loop until no more pages:**
```javascript
// Pseudocode pattern
let cursor = null
const allKeys = []

do {
  const response = await sdk.listOrgApiKeys({
    organization_id: orgId,
    limit: 100,
    after: cursor
  })
  
  allKeys.push(...response.data)
  cursor = response.list_metadata.after
} while (cursor)
```

Check fetched docs for default page size and maximum limit values.

---

## Runnable Verification

### Verify API Authentication
```bash
# Should return organization list or empty array
curl -X GET https://api.workos.com/user_management/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

### Test Organization API Key Creation
```bash
# Replace {org_id} with actual organization ID from Dashboard
curl -X POST https://api.workos.com/user_management/organization_api_keys \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "{org_id}",
    "name": "test-key"
  }'
```

### Validate Key Signature
```bash
# Replace {key_id} with ID from creation response
curl -X POST https://api.workos.com/user_management/organization_api_keys/validate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_id": "{key_id}"
  }'
```

**Expected success response:** HTTP 200 with `{"valid": true}`

---

## Rate Limit Guidance

Check fetched docs for current rate limits (limits vary by endpoint and plan tier).

**When you hit 429 Too Many Requests:**
1. Parse the `Retry-After` header (seconds until retry allowed)
2. Implement exponential backoff: 1s → 2s → 4s → 8s
3. For batch operations, add jitter to avoid thundering herd

**Pseudocode pattern:**
```javascript
async function withRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall()
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000
        await sleep(delay)
        continue
      }
      throw error
    }
  }
}
```

---

## Common Integration Traps

### Trap: Storing API keys in client-side code
Organization API keys are SECRET credentials. Never expose them in frontend JavaScript or mobile apps.

**Fix:** Create keys server-side only. For client authentication, use the AuthKit hosted UI flow which returns user tokens.

### Trap: Not handling key rotation
API keys don't expire, but you should rotate them periodically.

**Pattern:**
1. Create new key
2. Update services to use new key
3. Monitor for 24 hours
4. Delete old key

### Trap: Confusing environment keys
`WORKOS_API_KEY` (backend) vs `WORKOS_CLIENT_ID` (frontend) have different purposes.

**Decision tree:**
```
Backend API calls?
└─> Use WORKOS_API_KEY (starts with sk_)

Frontend AuthKit UI redirect?
└─> Use WORKOS_CLIENT_ID (starts with client_)
```

### Trap: Not validating webhook signatures
When receiving events from WorkOS, always validate the signature before processing.

**Pattern:** Check fetched docs for webhook signature verification — this prevents spoofed events.

---

## Related Skills

- **workos-authkit-base** — Core AuthKit concepts and authentication flows
- **workos-authkit-nextjs** — Next.js-specific AuthKit integration patterns
- **workos-authkit-react** — React-specific AuthKit UI components

---

## Verification Checklist

- [ ] API key authentication returns 200 (not 401)
- [ ] Organization API key creation succeeds with valid org_id
- [ ] List endpoint returns paginated results
- [ ] Key validation endpoint confirms signature
- [ ] Key deletion returns 204 No Content
- [ ] Rate limit errors trigger exponential backoff
- [ ] Error responses include actionable messages
