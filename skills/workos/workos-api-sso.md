---
name: workos-api-sso
description: WorkOS SSO API endpoints — connections, profiles, authorization URLs, and logout.
---

<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## When to Use

Use this API to integrate enterprise Single Sign-On (SSO) into your application. This API handles OAuth 2.0 flows with identity providers like Okta, Azure AD, and Google Workspace, allowing your B2B customers to authenticate their employees using their existing identity infrastructure. Reach for this when you need to redirect users to their company's login page, exchange authorization codes for user profiles, or manage SSO connections programmatically.

## Key Concepts

**Connection Model**
- `connection_id` (format: `conn_*`) — represents a configured SSO integration for one organization
- `organization_id` (format: `org_*`) — the WorkOS organization this connection belongs to
- Connection types: `SAML`, `GoogleOAuth`, `MicrosoftOAuth`, `GenericOIDC`
- Each connection has a state: `active`, `draft`, `inactive`, `validating`

**Authorization Flow Pattern**
1. Generate authorization URL with `client_id`, `redirect_uri`, `state`, and either `connection_id`, `organization_id`, or `provider`
2. Redirect user to that URL (they log in at their IdP)
3. IdP redirects back to your `redirect_uri` with a `code`
4. Exchange `code` for user profile via `/sso/token` endpoint
5. Profile includes `id`, `email`, `first_name`, `last_name`, `idp_id`, `connection_id`, `organization_id`

**Environment Variables**
- `WORKOS_API_KEY` — your secret key (format: `sk_*`)
- `WORKOS_CLIENT_ID` — your WorkOS application client ID

**Dashboard Context**
- Connections are created in WorkOS Dashboard under Organizations → [Org Name] → SSO
- Each connection requires configuration (SAML metadata URL or OAuth credentials) from the customer's IdP

**Logout Flow**
- Use `/sso/logout/authorize` to initiate IdP-aware logout
- Pass `session_id` (from login profile response) to log user out at IdP level
- Specify `redirect_uri` for post-logout redirect

**Connection Management**
- List connections: filter by `organization_id` or `connection_type`
- Get connection: retrieve config details (NOT secrets) by `connection_id`
- Delete connection: remove SSO integration (requires no active sessions)

**Common Trap: State Parameter**
- Always generate a cryptographically random `state` value
- Store it in your session before redirect
- Verify it matches on callback to prevent CSRF

**ID Prefixes**
- `conn_*` — connection ID
- `org_*` — organization ID
- `user_*` — user ID (from profile)
- `session_*` — session ID (for logout)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-sso.guide.md`
