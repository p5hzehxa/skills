---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to authenticate users via their company's identity provider (Okta, Azure AD, Google Workspace, etc.) instead of managing passwords directly. SSO is typically required for B2B SaaS applications where enterprise customers demand centralized authentication and IT control over user access.

## Documentation

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security

## Key Vocabulary

- **Organization** `org_` — the tenant entity representing a company configuring SSO
- **Connection** `conn_` — a configured link between an Organization and an identity provider
- **Profile** — the authenticated user object returned after successful SSO login
- **IdP** — Identity Provider (the external service like Okta or Azure AD)
- **SP** — Service Provider (your application in the SAML flow)
- **ACS URL** — Assertion Consumer Service URL (callback endpoint for SAML assertions)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
