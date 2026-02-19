<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Authentication Setup

All Admin Portal API requests require authentication via `Authorization: Bearer sk_...` header.

```bash
# Verify API key works
curl https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization":"org_01H1234567890"}'
```

Expected: `200 OK` with `{"link": "..."}`. If `401`, your API key is invalid or missing the `sk_` prefix.

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal/generate_link` | Generate a one-time Admin Portal link for an organization |
| GET | `/portal/provider_icons` | Retrieve available SSO provider icons |

## Operation Decision Tree

**When to use each endpoint:**

1. **User needs to configure SSO/Directory Sync** → POST `/portal/generate_link`
   - Returns a time-limited URL the user visits
   - Link expires after first use or timeout (check fetched docs for current TTL)

2. **Building custom UI showing provider options** → GET `/portal/provider_icons`
   - Returns icon URLs for supported SSO providers
   - Use for dropdown/selection interfaces before portal generation

## Generating Portal Links

### Required Parameters

- `organization` (string) — WorkOS organization ID with `org_` prefix
- `intent` (string) — Operation type: `"sso"`, `"dsync"`, or `"audit_logs"`

### Optional Parameters

Check fetched docs for:
- `return_url` — Where to redirect after portal actions complete
- `success_url` — Override for successful operations
- Additional intent-specific parameters

### Implementation Pattern

```python
# Pseudocode — check SDK docs for exact method signature
link = workos_client.portal.generate_link(
    organization="org_01H1234567890",
    intent="sso",
    return_url="https://yourapp.com/settings/sso"
)
# Returns: {"link": "https://portal.workos.com/...", "expires_at": "..."}
```

### Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Invalid organization ID format | Verify `org_` prefix and valid org exists |
| 400 | Invalid intent value | Use `"sso"`, `"dsync"`, or `"audit_logs"` exactly |
| 401 | Missing/invalid API key | Check `Authorization: Bearer sk_...` header |
| 404 | Organization not found | Confirm organization exists in your WorkOS account |
| 429 | Rate limit exceeded | Implement exponential backoff, check fetched docs for limits |

**Common trap:** Attempting to reuse an expired link returns `410 Gone` when the user visits it. Generate a fresh link on demand, don't cache.

## Retrieving Provider Icons

### Use Case

Display SSO provider logos in your application UI before users configure connections.

### Implementation Pattern

```javascript
// Pseudocode — check SDK docs for exact method signature
const icons = await workos.portal.listProviderIcons();
// Returns array of: [{provider: "GoogleOAuth", icon_url: "https://..."}, ...]
```

### Caching Strategy

Icon URLs are stable. Safe to cache for 24+ hours to reduce API calls.

```bash
# Verification command
curl https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: `200 OK` with JSON array of provider objects.

## Integration Verification

### 1. Generate Link Test

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization":"org_YOURORGID","intent":"sso"}'
```

**Success criteria:**
- Status `200`
- Response contains `link` field starting with `https://portal.workos.com/`
- Response contains `expires_at` timestamp

### 2. Link Expiration Test

Generate a link, wait for expiration time (check fetched docs), attempt to visit. Should show expiration message.

### 3. Provider Icons Test

```bash
curl https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq
```

**Success criteria:**
- Array length > 0
- Each object has `provider` and `icon_url` fields
- Icon URLs are accessible (200 response)

## Common Integration Patterns

### Pattern 1: Settings Page "Configure SSO" Button

```
User clicks "Configure SSO"
  ↓
Generate portal link with intent="sso"
  ↓
Redirect user to returned link
  ↓
User returns to return_url after config
  ↓
Webhook confirms connection active
```

### Pattern 2: Multi-Tenant Setup Flow

```
New organization onboarding
  ↓
Create WorkOS organization
  ↓
Generate portal link with intent="sso"
  ↓
Email link to organization admin
  ↓
Admin configures SSO in portal
  ↓
SSO active for org users
```

## Environment Variable Setup

```bash
# Required
export WORKOS_API_KEY="sk_live_..."        # Production key
export WORKOS_CLIENT_ID="client_..."       # For AuthKit integration

# Optional
export WORKOS_REDIRECT_URI="https://..."  # AuthKit callback
```

Verify keys are set:
```bash
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "✓ API key format valid" || echo "✗ Invalid API key"
```

## Rate Limits

Check fetched docs for current rate limits. Typical strategy:

```python
# Pseudocode retry pattern
def generate_link_with_retry(organization, intent, max_retries=3):
    for attempt in range(max_retries):
        try:
            return workos_client.portal.generate_link(organization, intent)
        except RateLimitError:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
```

## Architectural Decisions

### Generate Links On-Demand

**Do NOT** pre-generate and store portal links. They expire and cannot be reused. Generate when the user requests access.

### Return URL Validation

Set `return_url` to a route in your app that:
1. Confirms the portal action completed
2. Fetches updated connection status via API
3. Shows success message to user

**Trap:** Relying solely on return_url visit to confirm setup. Always verify connection status via webhooks or API polling.

## Related Skills

- workos-feature-admin-portal (feature overview and UI patterns)
- workos-api-sso (verifying SSO connections after portal setup)
- workos-api-directory-sync (verifying Directory Sync after portal setup)
