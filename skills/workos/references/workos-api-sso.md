<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## When to Use

Use this skill when you need to integrate enterprise Single Sign-On (SAML, OIDC, or other identity providers) into your application. This API handles the OAuth-style authorization flow that redirects users to their company's identity provider and returns authenticated user profiles. Reach for this when your app needs to support corporate login systems rather than individual social logins.

## Key Vocabulary

- **Connection** `conn_` — represents a configured SSO provider for an organization
- **Organization** `org_` — the business entity whose employees authenticate via SSO
- **Profile** — the authenticated user object returned after successful SSO login

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-sso.guide.md`

## Related Skills

- `workos-authkit-base` — pre-built UI components for SSO flows
- `workos-authkit-nextjs` — Next.js-specific SSO integration patterns
- `workos-authkit-react` — React SSO UI components
