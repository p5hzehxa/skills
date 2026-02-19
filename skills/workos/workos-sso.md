---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to let users sign in with their company's identity provider (Okta, Microsoft Entra ID, Google Workspace, etc.) instead of managing passwords yourself. Reach for SSO when selling to businesses that require centralized authentication, when you need to support SAML or OIDC flows, or when compliance demands enterprise-grade identity management.

## Documentation

- https://workos.com/docs/sso/test-sso
- https://workos.com/docs/sso/single-logout
- https://workos.com/docs/sso/signing-certificates
- https://workos.com/docs/sso/sign-in-consent
- https://workos.com/docs/sso/saml-security

## Key Concepts

**Core Entities**
- **Organization** (`org_`) — tenant that maps to a company; holds SSO connections
- **Connection** (`conn_`) — SSO provider config (SAML metadata or OIDC credentials)
- **Profile** — normalized user identity returned after SSO (email, name, raw IdP attributes)

**Authentication Flow Patterns**
- **Authorization URL** — redirect users here to start SSO; contains `client_id`, `redirect_uri`, optional `organization` or `connection`
- **Code Exchange** — swap authorization `code` for user `profile` and `access_token`
- **State Parameter** — anti-CSRF token you generate and validate after callback

**Identity Provider Types**
- **SAML** — XML-based; requires metadata URL or manual certificate upload
- **OIDC** — OAuth 2.0 + OpenID Connect; requires client credentials from IdP

**Dashboard Paths**
- Configure connections: **SSO → Connections**
- Test SSO flows: **SSO → Test SSO** (use `organization` parameter for production-like testing)
- View signing certificates: **SSO → Signing Certificates** (rotate before expiry)

**Critical Configuration**
- `WORKOS_API_KEY` (starts with `sk_`)
- `WORKOS_CLIENT_ID` (starts with `client_`)
- Redirect URI — must match exactly what you pass in authorization URL and configure in dashboard

**Single Logout (SLO)**
- Use when IdP logout should cascade to your app
- Requires SLO endpoint configuration in connection settings
- Check fetched docs for IdP-specific SLO support matrix

**Security Patterns**
- Verify state parameter on callback to prevent CSRF
- Validate JIT provisioning claims before creating users
- Use signing certificates to verify SAML assertions (auto-rotated by WorkOS)
- For consent screen customization, check dashboard **SSO → Sign-In Consent**

**Common Decision Points**
- **Organization vs Connection parameter** — use `organization` when user knows their company; use `connection` to hard-code a specific IdP
- **JIT provisioning** — create users on first SSO login vs requiring pre-provisioning
- **Domain claiming** — auto-route users by email domain vs manual connection selection

**Trap Warnings**
- Do NOT store raw SAML assertions — use WorkOS-normalized `profile` instead
- Do NOT skip state validation — this prevents account takeover attacks
- Redirect URI mismatch is the #1 integration issue — must match dashboard config exactly

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
