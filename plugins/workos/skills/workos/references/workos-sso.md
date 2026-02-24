

<!-- refined:sha256:1ef5b36e75cb -->

# WorkOS Single Sign-On

## When to Use

Use this skill when you need to let users authenticate through their company's identity provider (Okta, Azure AD, Google Workspace, etc.) instead of managing passwords yourself. SSO is the right choice when selling to enterprises that require centralized identity management or when you want to offload authentication infrastructure.

## Key Vocabulary

- **Organization** (`org_`) — represents a customer company with SSO configured
- **Connection** (`conn_`) — links an Organization to a specific identity provider
- **Profile** — the user data returned after successful SSO authentication
- **AuthKit** — WorkOS's hosted authentication UI that handles the SSO flow


## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-sso.guide.md`


## Related Skills

- **workos-integrations**: Provider-specific SSO setup
- **workos-rbac**: Role-based access after SSO
- **workos-directory-sync**: Sync user directories from IdPs
