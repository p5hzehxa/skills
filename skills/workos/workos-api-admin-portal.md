---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

Use the Admin Portal API to generate secure, time-limited links that allow your customers' IT admins to configure SSO, Directory Sync, or other WorkOS features without giving them access to your own dashboard. This API is essential when you need to embed enterprise configuration into your product's settings or onboarding flow.

## Key Concepts

### Core Resources
- **Portal Link** — a short-lived, signed URL that grants an organization's admin access to configure WorkOS features
- **Intent** — the feature scope the portal link grants access to (e.g., `sso`, `dsync`, `audit_logs`, `log_streams`)
- **Organization** — the WorkOS entity (`org_*`) whose settings the portal link will configure
- **Return URL** — the URL in your application where the admin is redirected after completing configuration

### ID Prefixes
- `org_*` — Organization ID (required for all portal link generation)
- Portal links themselves are opaque, signed tokens (not prefixed IDs)

### API Patterns
- Portal links are **single-use** and expire after a set time window
- Always generate a fresh link per configuration session — do not reuse
- The link grants access scoped to ONE organization and ONE intent
- Return URLs must be HTTPS in production (HTTP allowed in development)

### Dashboard Navigation
- **Admin Portal settings** — configure allowed return URLs and link expiration policies
- **Organizations** — view which orgs have accessed portal links and when

### Common Decision Points
- **Multiple intents** — generate separate links for each feature (SSO, Directory Sync, etc.) or use a combined intent if the admin needs to configure multiple features in one session
- **Return URL strategy** — use query parameters to track which organization/user triggered the configuration flow
- **Link expiration** — balance security (shorter expiration) against admin convenience (longer window for interrupted sessions)

### Verification
```bash
# Confirm portal link generation works
curl https://api.workos.com/portal/links/generate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization":"org_123","intent":"sso","return_url":"https://yourapp.com/settings"}'
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-admin-portal.guide.md`
