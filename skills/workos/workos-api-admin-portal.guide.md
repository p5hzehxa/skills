<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## What is the Admin Portal API?

The Admin Portal API generates secure, time-limited URLs that let your customers configure their SSO, Directory Sync, and other WorkOS integrations without exposing your WorkOS Dashboard credentials. You embed these portal links in your application's settings UI.

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal/generate_link` | Create a time-limited portal URL for an organization |
| GET | `/portal/provider_icons` | Fetch SSO provider logos for UI rendering |

## Authentication Setup

All Admin Portal API calls require bearer authentication:

```bash
Authorization: Bearer sk_your_api_key_here
```

Set `WORKOS_API_KEY` in your environment. The key must start with `sk_` and have Admin Portal permissions enabled in your WorkOS Dashboard.

## Operation Decision Tree

**When to use which endpoint:**

1. **Customer needs to configure SSO/SCIM** → `POST /portal/generate_link` with `intent: "sso"` or `intent: "dsync"`
2. **Customer needs to view audit logs** → `POST /portal/generate_link` with `intent: "audit_logs"`
3. **Customer needs domain verification** → `POST /portal/generate_link` with `intent: "domain_verification"`
4. **You're building a provider selection UI** → `GET /portal/provider_icons` to display logos

**Key architectural decision:** Portal links expire after a configurable period (default 5 minutes). Generate links on-demand when the user clicks "Configure SSO" — do NOT pre-generate and cache them.

## Generating Portal Links

### Request Pattern

```http
POST https://api.workos.com/portal/generate_link
Authorization: Bearer sk_...
Content-Type: application/json

{
  "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
  "intent": "sso",
  "return_url": "https://yourapp.com/settings"
}
```

### Intent Types

Check fetched docs for the complete list of supported intent values. Common intents include:
- `sso` — SSO connection setup
- `dsync` — Directory Sync configuration
- `audit_logs` — Audit log viewer
- `domain_verification` — Domain ownership verification

### Response Pattern

```json
{
  "link": "https://id.workos.com/portal/launch?token=...",
  "object": "portal_link"
}
```

Redirect the user to the `link` URL immediately. Do NOT display the URL as plain text (security risk).

### SDK Usage Pattern

```pseudocode
// When user clicks "Configure SSO" button
const portalLink = await workos.portal.generateLink({
  organization: currentOrganization.id,
  intent: 'sso',
  returnUrl: `${appBaseUrl}/settings/sso/callback`
})

// Immediately redirect
window.location.href = portalLink.link
```

Check fetched docs for exact SDK method signature in your language.

## Provider Icons Endpoint

Use this endpoint to display SSO provider logos in your connection setup UI.

### Request Pattern

```http
GET https://api.workos.com/portal/provider_icons
Authorization: Bearer sk_...
```

### Response Pattern

```json
{
  "data": [
    {
      "provider": "GoogleOAuth",
      "icon_url": "https://workos.com/icons/google.svg"
    }
  ]
}
```

### SDK Usage Pattern

```pseudocode
// Fetch once on component mount, cache the result
const icons = await workos.portal.listProviderIcons()

// Map provider names to icon URLs
const iconMap = Object.fromEntries(
  icons.data.map(icon => [icon.provider, icon.iconUrl])
)

// Render in UI
<img src={iconMap['GoogleOAuth']} alt="Google" />
```

Check fetched docs for exact SDK method signature and response schema.

## Error Handling

### HTTP 400 — Invalid Request

**Causes:**
- `organization` ID is malformed (must start with `org_`)
- `intent` value is not supported (check fetched docs for valid values)
- `return_url` is not HTTPS in production

**Fix:**
- Validate organization ID format before calling API
- Use a supported intent constant from SDK
- Ensure return URL uses HTTPS in production environments

### HTTP 401 — Unauthorized

**Causes:**
- `WORKOS_API_KEY` is missing or malformed
- API key does not have Admin Portal permissions

**Fix:**
- Verify key starts with `sk_`
- Check Dashboard → API Keys → ensure key has "Admin Portal" scope enabled

### HTTP 404 — Organization Not Found

**Causes:**
- Organization ID does not exist in your WorkOS environment
- Organization was deleted

**Fix:**
- Verify organization exists: `GET /organizations/{organization_id}`
- Check you're using the correct environment (staging vs production keys)

### HTTP 429 — Rate Limit Exceeded

**Cause:** Too many portal link generations for the same organization in a short time window

**Fix:** 
- Implement client-side rate limiting (1 link per 30 seconds per org)
- Show error message: "Please wait before regenerating the portal link"
- Do NOT retry automatically — this will extend the lockout

## Verification Commands

Test your integration with these curl commands:

```bash
# Generate a portal link
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHQMYV6MBK39QC5PZXHY59C3",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'

# Expected: 200 OK with {"link": "https://id.workos.com/portal/launch?token=...", ...}

# Fetch provider icons
curl https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Expected: 200 OK with {"data": [{"provider": "...", "icon_url": "..."}], ...}
```

## Common Integration Traps

1. **Displaying portal links as copyable text** → Security risk. Always redirect immediately using `window.location.href` or HTTP 302.
2. **Caching portal links** → Links expire (default 5 minutes). Generate on-demand when user clicks the button.
3. **Not handling return_url callbacks** → User lands on return_url after completing setup. Detect completion via webhook or by re-checking organization connection status.
4. **Using HTTP return_url in production** → WorkOS rejects non-HTTPS return URLs in production. Use HTTPS or omit return_url for testing.
5. **Not validating intent parameter** → Mismatched intent (e.g., `dsync` when user expects SSO setup) causes user confusion. Match intent to the UI button clicked.

## Return URL Flow

After the user completes setup in the Admin Portal:

1. WorkOS redirects to your `return_url`
2. No query parameters are appended by default (check fetched docs for latest behavior)
3. Poll organization connection status or listen for `connection.activated` webhook
4. Display success message in your application

## Environment Variables

Set these in your application environment:

```bash
WORKOS_API_KEY=sk_live_... # or sk_test_... for staging
```

Do NOT hardcode API keys in source code. Use environment variables or secret management.

## Related Skills

- **workos-authkit-nextjs** — Integrates Admin Portal with Next.js authentication flows
- **workos-authkit-react** — React components for embedding portal links
