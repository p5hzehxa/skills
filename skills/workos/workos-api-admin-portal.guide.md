<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Authentication Setup

Set environment variables:

```bash
export WORKOS_API_KEY="sk_live_..." # or sk_test_...
export WORKOS_CLIENT_ID="client_..."
```

All API requests require the API key in the Authorization header:

```bash
Authorization: Bearer sk_live_...
```

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal/generate_link` | Generate time-limited Admin Portal access URL |
| GET | (provider icons) | Retrieve identity provider logos for UI display |

The Admin Portal API surface is intentionally minimal — it generates secure access links to WorkOS-hosted configuration UIs.

## Operation Decision Tree

**When to use Admin Portal:**
- **Customer needs to configure SSO** → Generate portal link with `intent=sso`
- **Customer needs to configure Directory Sync** → Generate portal link with `intent=dsync`
- **Customer needs to configure Log Streams** → Generate portal link with `intent=log_streams`
- **Customer needs to configure Audit Logs** → Generate portal link with `intent=audit_logs`
- **Building a custom UI?** → DON'T use Admin Portal. Use the core SSO/Directory Sync APIs instead.

**Organization targeting:**
- You MUST specify the organization for which you're generating the portal link
- Use `organization` parameter with the organization ID (format: `org_...`)

**Return URL strategy:**
- Specify where customers land after completing configuration
- Use `return_url` parameter with your application callback URL
- WorkOS redirects to this URL when customer exits the portal

## Generate Portal Link Pattern

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHZNVPK3SFK441A1RGBFSHRT",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

**SDK pseudocode pattern:**

```
portal_link = workos.portal.generate_link(
  organization="org_...",
  intent="sso",  # or "dsync", "log_streams", "audit_logs"
  return_url="https://yourapp.com/settings"
)

redirect_customer_to(portal_link.link)
```

Check fetched docs for exact SDK method signature in your language.

## Intent-Specific Patterns

**SSO Configuration (`intent=sso`):**
- Allows customer to configure SAML or OIDC providers
- Customer can enable/disable connections
- Customer can test SSO flow before saving

**Directory Sync Configuration (`intent=dsync`):**
- Allows customer to configure directory providers (Okta Directory, Azure AD, Google Workspace)
- Customer can map directory groups to application roles
- Customer can configure sync schedules

**Log Streams Configuration (`intent=log_streams`):**
- Allows customer to configure event streaming destinations
- Customer can filter which event types to stream

**Audit Logs Configuration (`intent=audit_logs`):**
- Allows customer to configure audit log exports
- Customer can set retention policies

## Error Handling

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in dashboard |
| 404 | Organization not found | Verify organization ID format (`org_...`) and existence via Organizations API |
| 422 | Invalid intent value | Use one of: `sso`, `dsync`, `log_streams`, `audit_logs` |
| 422 | Invalid return_url format | Ensure return_url is a valid HTTPS URL |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay, double on each retry) |

**Specific error responses:**

```json
{
  "error": "invalid_organization",
  "error_description": "Organization org_123 does not exist"
}
```

→ Verify organization was created and ID is correct

```json
{
  "error": "invalid_intent", 
  "error_description": "Intent must be one of: sso, dsync, log_streams, audit_logs"
}
```

→ Check intent parameter spelling and casing

## Link Expiration

Portal links expire after a short time window. Check fetched docs for current expiration policy.

**Pattern for handling expiration:**

```
if customer_clicks_expired_link:
  regenerate_portal_link()
  redirect_to_new_link()
```

Do NOT cache portal links. Generate fresh links on each customer request.

## Provider Icons

WorkOS provides standardized identity provider logos for UI consistency.

**Icon URL pattern:**

Check fetched docs at https://workos.com/docs/reference/admin-portal/provider-icons for current CDN URLs and available providers.

**Usage pattern:**

```html
<img src="[provider-icon-url]" alt="[Provider Name]" />
```

Use these icons when displaying SSO/directory provider options in your application UI.

## Verification Commands

**Test link generation:**

```bash
LINK=$(curl -s -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01EHZNVPK3SFK441A1RGBFSHRT",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }' | jq -r '.link')

echo "Generated portal link: $LINK"
```

Expected response contains a `link` field with format `https://id.workos.com/portal/...`

**Verify organization exists:**

```bash
curl -X GET "https://api.workos.com/organizations/org_01EHZNVPK3SFK441A1RGBFSHRT" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Should return 200 with organization object.

## Rate Limits

Check fetched docs for current rate limits. Typical pattern:

- Implement retry logic with exponential backoff
- Cache organization data to reduce API calls
- Generate portal links on-demand, not in bulk

## Common Integration Patterns

**Embedded "Configure SSO" button:**

```
on_click_configure_sso_button:
  portal_link = generate_portal_link(
    organization=current_customer_org_id,
    intent="sso",
    return_url=current_page_url
  )
  redirect_customer_to(portal_link)
```

**Settings page with multiple intents:**

```
available_intents = ["sso", "dsync", "log_streams"]

for each intent in available_intents:
  if customer_has_access_to(intent):
    display_configure_button(
      label=intent_label(intent),
      on_click=lambda: generate_and_redirect(intent)
    )
```

**Post-configuration callback:**

When customer completes configuration and returns via `return_url`, WorkOS appends no query parameters. Detect completion by:

1. Checking if customer lands on return_url after being away
2. Fetching latest organization/connection state via API
3. Displaying confirmation UI if configuration changed

## Related Skills

- workos-sso-api — Core SSO API for building custom configuration UIs
- workos-directory-sync-api — Core Directory Sync API for custom directory management
- workos-organizations-api — Managing organizations that use Admin Portal
