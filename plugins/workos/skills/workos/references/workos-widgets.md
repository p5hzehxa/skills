<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use this skill when you need to embed pre-built WorkOS UI components (like user management, organization settings, or SSO configuration flows) directly into your application. Widgets provide authenticated, ready-to-use interfaces without requiring custom frontend implementation. They're ideal when you want WorkOS-managed UI consistency across your product.

## Key Vocabulary

- **Widget Token** — Short-lived JWT required to load any Widget (expires in 10 minutes)
- **Session Token** — The User Management session JWT passed when generating Widget tokens for authenticated contexts
- **Widget Scope** — Defines which Widget type to load (`sso-config`, `log-streams`, etc.)
- **Redirect URI** — Where the Widget redirects after completion (must match Dashboard configuration)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-widgets.guide.md`

## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
