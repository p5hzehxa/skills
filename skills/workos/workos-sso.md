---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when implementing enterprise Single Sign-On authentication via SAML or OIDC identity providers. This is the right skill when you need to allow users to authenticate through their organization's identity provider (like Okta, Azure AD, or Google Workspace) instead of managing passwords directly.

## Documentation

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security

## Key Vocabulary

- **Organization** `org_` — tenant entity that owns SSO connections
- **Connection** `conn_` — configured link to an identity provider
- **Profile** — normalized user identity returned after authentication
- **WORKOS_API_KEY** — server-side authentication credential
- **WORKOS_CLIENT_ID** — identifies your application to WorkOS
- **redirect_uri** — callback URL where WorkOS sends authentication responses
- **state** parameter — CSRF protection token for OAuth flows

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
