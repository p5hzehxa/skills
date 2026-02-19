---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use this skill when you need to let customer admins configure SSO connections, Directory Sync, or other WorkOS integrations without contacting your support team. Admin Portal provides a self-service UI where your customers can manage their own WorkOS configurations — you generate a short-lived link, they complete the setup, and WorkOS handles the UI and validation.

## Documentation

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

## Key Concepts

### Portal Sessions
- **Portal link** — temporary URL (1 hour expiry) generated via `portal_sessions.create()`
- **Organization ID** — the `organization` parameter identifying which customer's config to manage
- **Intent** — what the customer is configuring (`sso`, `dsync`, `log_streams`, `domain_verification`, `audit_logs`)
- **Return URL** — where WorkOS redirects after the customer completes or cancels setup

### ID Prefixes and Env Vars
- `org_*` — organization identifier passed to `portal_sessions.create()`
- `WORKOS_API_KEY` — server-side key for generating portal links (never expose to browser)

### Integration Pattern
1. Customer clicks "Configure SSO" in your app
2. Your backend calls `portal_sessions.create()` with `organization` and `intent`
3. Redirect customer to the returned `link` URL
4. WorkOS handles the configuration UI
5. Customer is redirected to your `return_url` on completion

### Architectural Decisions
- **Server-side only** — generate portal links from your backend; never expose `WORKOS_API_KEY` to the browser
- **Short-lived by design** — links expire in 1 hour; generate a fresh link each time
- **Single intent per session** — if a customer needs to configure both SSO and Directory Sync, generate two separate portal sessions
- **Conditional access** — only generate portal links for customers who have the feature enabled in your app's billing/permissions logic

### Custom Branding
- Dashboard: WorkOS Dashboard → Branding
- Configure logo, colors, button styles
- Changes apply to all portal sessions for your WorkOS environment

### Common Traps
- **Don't cache portal links** — they expire in 1 hour; generate on-demand
- **Don't share links across organizations** — each link is scoped to one `organization` ID
- **Don't skip return URL validation** — verify the returning customer matches the organization that started the session

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
