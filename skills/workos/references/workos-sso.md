<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to let users authenticate through their company's identity provider (Okta, Azure AD, Google Workspace, etc.) instead of managing passwords yourself. This enables enterprise customers to use their existing SSO infrastructure and enforces their security policies in your app.

## Key Vocabulary

- **Organization** `org_` — represents a company/tenant using SSO
- **Connection** `conn_` — links an Organization to a specific IdP (one per provider type)
- **Profile** `prof_` — the authenticated user identity returned after SSO

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-sso.guide.md`

## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
