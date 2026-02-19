---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use Widgets to embed pre-built UI components for user account management (profile editing, security settings, session management) into your application without building custom interfaces. Widgets are iframe-based components that handle their own authentication and styling while integrating with your WorkOS Directory Sync or User Management setup.

## Key Vocabulary

- **Widget Token** — short-lived JWT generated server-side to authenticate widget sessions
- **User ID** `user_` — identifier for the user accessing the widget
- **Organization ID** `org_` — identifier for the user's organization (optional, for multi-tenant apps)
- **Session widget** — displays active user sessions with revocation controls
- **Security widget** — manages MFA enrollment and authentication methods
- **Profile widget** — handles user profile information updates
- **User Management widget** — administrative interface for managing organization users
- `WORKOS_API_KEY` — server-side credential for generating widget tokens
- `scope` parameter — defines which widget type to load (`session`, `security`, `profile`, `user_management`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-widgets.guide.md`

## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
