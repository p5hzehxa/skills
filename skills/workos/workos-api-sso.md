---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## When to Use

Use this API to programmatically manage SSO connections, generate OAuth authorization URLs, exchange codes for user profiles, and initiate logout flows. Reach for this when building custom SSO UI or automating connection provisioning outside of the Admin Portal.

## Documentation

- https://workos.com/docs/reference/sso
- https://workos.com/docs/reference/sso/connection
- https://workos.com/docs/reference/sso/connection/delete
- https://workos.com/docs/reference/sso/connection/get
- https://workos.com/docs/reference/sso/connection/list

## Key Vocabulary

- **Connection** `conn_` — SSO provider configuration linked to an Organization
- **Organization** `org_` — entity grouping SSO connections
- **Profile** — user identity data returned after successful SSO authentication
- **Authorization URL** — OAuth redirect entry point for SSO login flow
- **Redirect URI** — callback URL where WorkOS sends authorization codes
- **State parameter** — CSRF token passed through OAuth flow
- **Connection type** — SSO provider identifier (e.g., `SAML`, `GoogleOAuth`, `MicrosoftOAuth`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-sso.guide.md`

## Related Skills

- workos-authkit-base — pre-built SSO UI alternative to direct API usage
