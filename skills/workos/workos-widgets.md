---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use this skill when you need to embed pre-built UI components for user account management, security settings, or profile editing into your application. Widgets provide browser-based interfaces that users interact with directly, powered by server-side tokens you generate. Choose this over custom UI when you want WorkOS-managed experiences for common user self-service flows.

## Documentation

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens

## Key Vocabulary

- **Widget Token** — short-lived JWT (`wgt_`) that authorizes a widget session
- **User Sessions Widget** — displays active sessions with revocation controls
- **User Security Widget** — MFA enrollment and authentication method management
- **User Profile Widget** — editable user profile fields (name, email)
- **User Management Widget** — organization membership and role management


## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-widgets.guide.md`


## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
