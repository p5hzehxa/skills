---
name: workos-sso
description: Configure Single Sign-On with SAML and OIDC identity providers.
---

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to authenticate users via their company's identity provider (IdP) instead of managing passwords yourself. SSO enables enterprise customers to control access through their existing systems (Okta, Microsoft Entra ID, Google Workspace, etc.), meeting security and compliance requirements that block username/password auth.

## Key Vocabulary

- **Connection** `conn_` — links your app to a customer's IdP configuration
- **Organization** `org_` — represents a customer company with one or more Connections
- **Profile** — user identity attributes returned after successful SSO (email, first/last name, IdP ID)
- **Authorization URL** — WorkOS-hosted login page where users authenticate via their IdP
- **SAML** — XML-based SSO protocol (most enterprise IdPs)
- **OIDC** — OAuth 2.0-based SSO protocol (Google Workspace, Microsoft)
- **Single Logout (SLO)** — terminates sessions across your app and the IdP simultaneously
- **Signing Certificate** — public key used to verify SAML assertions from IdPs

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
