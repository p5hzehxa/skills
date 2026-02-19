<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Prerequisites

- WorkOS API key starting with `sk_` (env var: `WORKOS_API_KEY`)
- WorkOS Client ID starting with `client_` (env var: `WORKOS_CLIENT_ID`)
- Organization ID for the target organization

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal/generate_link` | Generate a one-time Admin Portal link for an organization |
| GET | `/portal/provider_icons` | Retrieve available SSO provider icons |

## Authentication

Include your API key in the `Authorization` header:

```
Authorization: Bearer sk_your_api_key
```

SDK handles this automatically when you initialize:

```
workos_client = WorkOS(api_key=os.getenv('WORKOS_API_KEY'))
```

## Operation Decision Tree

### When to generate a portal link

Generate a new portal link when:
- User clicks "Configure SSO" in your application
- Admin needs to update SSO settings
- New organization setup flow requires SSO configuration

**Do NOT reuse portal links** — they are single-use and expire. Generate a fresh link for each session.

### Link parameters

Set `intent` to control which Admin Portal section the user lands on:
- `sso` — SSO configuration (most common)
- `dsync` — Directory Sync configuration
- `log_streams` — Log Streams configuration
- `audit_logs` — Audit Logs configuration

Set `return_url` to redirect users back to your application after they complete configuration.

## Generate Portal Link Pattern

```
POST /portal/generate_link
{
  "organization": "org_12345",
  "intent": "sso",
  "return_url": "https://yourapp.com/settings/sso/complete"
}

Response 201:
{
  "link": "https://id.workos.com/portal/launch?token=...",
  "object": "portal_link"
}
```

**Implementation pseudocode:**

```python
# When user clicks "Configure SSO"
portal_link = workos_client.portal.generate_link(
    organization="org_12345",
    intent="sso",
    return_url="https://yourapp.com/settings/sso/complete"
)

# Redirect user immediately
redirect_to(portal_link.link)
```

**Critical trap:** The link expires quickly. Generate it on-demand when the user clicks, NOT in advance.

## Provider Icons Pattern

Fetch available provider icons to show users SSO options in your UI:

```
GET /portal/provider_icons

Response 200:
{
  "data": [
    {
      "type": "provider_icon",
      "name": "Okta",
      "slug": "okta",
      "icon_url": "https://..."
    },
    ...
  ]
}
```

**Implementation pseudocode:**

```python
# Fetch once on page load, cache in your app
icons = workos_client.portal.list_provider_icons()

# Render in UI
for icon in icons:
    display_provider_option(icon.name, icon.icon_url)
```

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | API key missing or invalid | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 404 | Organization ID not found | Check organization exists: `workos_client.organizations.get_organization("org_id")` |
| 422 | Invalid intent value | Use only: `sso`, `dsync`, `log_streams`, `audit_logs` |
| 422 | Invalid return_url format | Must be valid HTTPS URL. Verify: `return_url.startswith("https://")` |
| 429 | Rate limit exceeded | Implement exponential backoff. Wait 1s, then 2s, then 4s before retry |

**Debug command for 401 errors:**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations \
  -w "\nHTTP Status: %{http_code}\n"
```

If this returns 401, your API key is invalid. Generate a new key in Dashboard → API Keys.

## Pagination Handling

Provider icons API returns all icons in a single response. No pagination required.

## Runnable Verification

**Test 1: Verify API key works**

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations \
  | jq '.data[0].id'
```

Expected: Should print an organization ID like `org_12345`. If 401, API key is wrong.

**Test 2: Generate a portal link**

```bash
curl -X POST https://api.workos.com/portal/generate_link \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_YOUR_ORG_ID",
    "intent": "sso",
    "return_url": "https://example.com/callback"
  }' | jq '.link'
```

Expected: Should print a portal URL starting with `https://id.workos.com/portal/launch`. Open in browser to verify.

**Test 3: Fetch provider icons**

```bash
curl https://api.workos.com/portal/provider_icons \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```

Expected: Should print a number (e.g., `15`). This is the count of available SSO providers.

## Rate Limit Guidance

Admin Portal API has standard WorkOS rate limits. If you hit 429:

1. Implement exponential backoff with jitter
2. Do NOT generate portal links in loops — generate on-demand per user click
3. Cache provider icons — they rarely change

**Retry pseudocode:**

```python
max_retries = 3
for attempt in range(max_retries):
    try:
        return workos_client.portal.generate_link(...)
    except RateLimitError:
        if attempt == max_retries - 1:
            raise
        sleep(2 ** attempt + random.uniform(0, 1))
```

## Common Integration Patterns

### Pattern 1: SSO Configuration Flow

```
User clicks "Configure SSO" in your app
  → Generate portal link with intent="sso"
  → Redirect to portal link
  → User configures SSO in Admin Portal
  → WorkOS redirects to return_url
  → Your app shows "SSO configured" confirmation
```

### Pattern 2: Multi-Product Setup

If your app supports SSO + Directory Sync, generate separate links:

```python
# Step 1: SSO setup
sso_link = generate_link(org, intent="sso", return_url="/setup/dsync")
# After SSO complete, show Directory Sync option
dsync_link = generate_link(org, intent="dsync", return_url="/setup/complete")
```

**Do NOT** generate both links upfront — the second link may expire before user reaches it.

### Pattern 3: Embedded Admin Panel

If you want to show SSO provider options before launching portal:

```python
# On page load
icons = workos_client.portal.list_provider_icons()
display_provider_selection_ui(icons)

# When user selects a provider
portal_link = generate_link(org, intent="sso", return_url="/callback")
redirect_to(portal_link.link)
```

## Debugging Checklist

- [ ] API key starts with `sk_` and is set in `WORKOS_API_KEY`
- [ ] Organization ID exists (verify with `workos_client.organizations.get_organization()`)
- [ ] `return_url` is a valid HTTPS URL
- [ ] `intent` is one of: `sso`, `dsync`, `log_streams`, `audit_logs`
- [ ] Portal link is generated on-demand, not pre-generated
- [ ] User is redirected immediately after link generation (links expire quickly)

## Related Skills

- workos-sso-base — Understanding SSO concepts before implementing Admin Portal
- workos-directory-sync-base — Directory Sync configuration via Admin Portal
