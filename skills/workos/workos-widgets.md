---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use Widgets when you need to embed pre-built UI components for user profile management, session management, or security settings. Widgets provide drop-in React/JavaScript components that handle user-facing workflows without building custom UIs. They integrate with User Management and require a Widgets API token for initialization.

## Documentation

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens

## Key Vocabulary

- **Widget Token** — short-lived JWT for initializing Widgets components
- **User Management ID** (`user_`) — identifier for the authenticated user
- **Organization ID** (`org_`) — identifier for the user's organization context
- **Session** — user authentication state managed by Widgets
- **Profile Widget** — component for displaying/editing user profile data
- **Security Widget** — component for managing MFA and password settings
- **Session Widget** — component for viewing active sessions and devices

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-widgets.guide.md`

## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
