---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## When to Use

Use this skill when you need direct API-level control over SSO connections, user profiles, or authorization flows — bypassing AuthKit's managed UI. Reach for this when building custom authentication experiences, integrating SSO into non-web contexts, or managing connections programmatically. If you're building a standard web app with hosted login, use `workos-authkit-*` skills instead.

## Documentation

- https://workos.com/docs/reference/sso
- https://workos.com/docs/reference/sso/connection
- https://workos.com/docs/reference/sso/connection/delete
- https://workos.com/docs/reference/sso/connection/get
- https://workos.com/docs/reference/sso/connection/list

## Key Vocabulary

- **Connection** `conn_` — an SSO provider configuration (e.g., Okta, Google Workspace)
- **Organization** `org_` — tenant entity that owns connections
- **Profile** — user identity data returned after SSO authentication
- **Authorization URL** — the redirect target for initiating SSO login
- **`redirect_uri`** — callback URL where WorkOS sends auth codes after login
- **`state`** — CSRF token passed through the OAuth flow
- **Logout URL** — endpoint for triggering provider-initiated logout

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-sso.guide.md`

## Related Skills

- `workos-authkit-base` — managed SSO with hosted UI
- `workos-sso-guide` — setup wizard for SSO connections
