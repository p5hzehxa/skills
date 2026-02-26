<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to let users sign in using their organization's identity provider (Okta, Azure AD, Google Workspace, etc.) instead of managing passwords yourself. This skill handles the OAuth/SAML flow for enterprise SSO, returning authenticated user profiles to your application.

## Key Vocabulary

- **Organization** `org_` — the company/tenant whose IdP users authenticate through
- **Connection** `conn_` — the configured link between an Organization and their IdP (e.g., `conn_okta_123`)
- **Profile** `profile_` — the authenticated user object returned after SSO, containing email/name/IdP metadata

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
