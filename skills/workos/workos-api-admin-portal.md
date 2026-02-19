---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/portal_links` | Generate a one-time portal link for an organization |
| GET | `/provider_icons` | Retrieve available identity provider icons |

## Authentication Setup

Add your API key to request headers:

```
Authorization: Bearer sk_live_...
```

Set environment variable:
```bash
export WORKOS_API_KEY=sk_live_your_key_here
```

Verify your key starts with `sk_test_` (test) or `sk_live_` (production).

## Operation Decision Tree

**Need to let users manage SSO/Directory Sync?**
→ Generate a portal link with `POST /portal_links`

**Need organization branding/provider logos?**
→ Fetch icons with `GET /provider_icons`

**Portal link expired or used?**
→ Generate a new one (links are single-use and time-limited)

## Generating Portal Links

### Required Parameters

Check fetched docs for current parameter requirements. Common pattern:

```bash
curl https://api.workos.com/portal_links \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01H...",
    "intent": "sso",
    "return_url": "https://yourapp.com/settings"
  }'
```

### Intent Values

Check fetched docs for complete list. Common intents:
- `sso` — SSO configuration
- `dsync` — Directory Sync setup
- `audit_logs` — Audit log streaming
- `log_streams` — Log stream configuration

### Return URL Handling

The `return_url` is where users land after completing portal tasks. Use organization-specific URLs to maintain context:

```
https://yourapp.com/org/{org_id}/settings
```

## Provider Icons

Retrieve identity provider logos for UI customization:

```bash
curl https://api.workos.com/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Use returned icon URLs in your SSO connection UI to display provider branding.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `WORKOS_API_KEY` is set and starts with `sk_` |
| 404 | Organization not found | Confirm `organization` ID exists and is not deleted |
| 422 | Invalid intent or missing required fields | Check fetched docs for required parameters per intent |
| 429 | Rate limit exceeded | Implement exponential backoff, check rate limit headers |

Check response body for `message` field with specific error details.

## Link Lifecycle

Portal links are:
- **Single-use** — consumed when user accesses them
- **Time-limited** — check fetched docs for current expiration window
- **Organization-scoped** — tied to one organization ID

**When to regenerate:**
- Link expired before user accessed it
- User needs to return to portal for additional configuration
- Previous link was accidentally exposed

## Verification Commands

### Test API connectivity
```bash
curl https://api.workos.com/provider_icons \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

Expected: 200 response with provider icon array

### Generate test portal link
```bash
curl https://api.workos.com/portal_links \
  -X POST \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "organization": "org_01H...",
    "intent": "sso",
    "return_url": "https://example.com"
  }'
```

Expected: 201 response with `link` field containing portal URL

### Verify link structure
Generated links follow pattern:
```
https://id.workos.com/portal/launch?token=...
```

Token is opaque and should not be parsed.

## SDK Integration Pattern

```typescript
// Generate portal link
const { link } = await workos.portal.generateLink({
  organization: 'org_01H...',
  intent: 'sso',
  returnUrl: 'https://yourapp.com/settings'
});

// Redirect user
response.redirect(link);
```

Check fetched docs for exact SDK method signatures per language.

## Rate Limits

Portal link generation is subject to rate limits. Check response headers:
- `X-RateLimit-Limit` — requests allowed per window
- `X-RateLimit-Remaining` — requests remaining
- `X-RateLimit-Reset` — window reset time (Unix timestamp)

Implement retry logic with exponential backoff when hitting 429 responses.

## Dashboard Configuration

Navigate to **WorkOS Dashboard → Configuration → Redirects** to:
- Whitelist return URLs for portal link generation
- Configure post-setup redirect behavior

Non-whitelisted return URLs will cause 422 errors.

## Common Traps

**Trap: Reusing expired portal links**
Portal links are single-use. Store the organization ID, not the link, and regenerate on demand.

**Trap: Hardcoding intent values**
Intent options expand as WorkOS adds features. Fetch docs for current list rather than assuming.

**Trap: Not handling link expiration**
Users may not access links immediately. Implement regeneration flow in your UI.

**Trap: Missing return_url whitelist**
Return URLs must be registered in dashboard. Test with non-production URLs first.

## Related Skills

- `workos-authkit-base` — Understanding WorkOS authentication setup
- `workos-organizations` — Managing organizations that use Admin Portal
