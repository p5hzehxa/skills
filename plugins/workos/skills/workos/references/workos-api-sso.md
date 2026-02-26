<!-- refined:sha256:ddc720812ac2 -->

# WorkOS SSO API Reference

## When to Use

Use this skill when you need to implement enterprise Single Sign-On flows (SAML, OAuth, OIDC) for your application. This API handles the authorization flow, token exchange, and user profile retrieval from identity providers. It's the right choice when building B2B authentication or when customers require SSO integration with their corporate identity systems.

## Key Vocabulary

- **Connection** `conn_` — represents a configured SSO integration with an identity provider
- **Profile** — the user identity object returned after successful SSO authentication
- **Authorization URL** — the redirect URL that initiates the SSO flow with the identity provider

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-sso.guide.md`

## Related Skills

- workos-authkit-base — for pre-built authentication UI with SSO support
- workos-authkit-nextjs — for Next.js-specific SSO integration patterns
- workos-authkit-react — for React-based SSO implementations
