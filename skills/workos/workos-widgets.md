---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use this skill when you need to embed pre-built UI components for user account management in your application. Widgets provides drop-in components for user sessions, security settings, profile management, and organization administration — allowing end users to manage their own accounts without building custom interfaces.

## Documentation

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens

## Key Concepts

**Widget Types**
- **User Sessions** — active session list with device info and revocation controls
- **User Security** — MFA enrollment, password changes, passkey management
- **User Profile** — name, email, profile picture editing
- **User Management** — organization membership, role assignments, invitations

**Token Generation Pattern**
- Generate short-lived tokens server-side using `workos.widgets.getToken()` with user ID
- Pass token to client component via secure prop/attribute
- Widget authenticates with token and renders for that user
- Tokens expire quickly — generate fresh token per page load

**Integration Flow**
1. Server endpoint generates widget token for authenticated user
2. Client component receives token as prop
3. Widget initializes and fetches user-specific data
4. User actions (e.g., MFA enrollment, session revoke) trigger server-side changes
5. Widget reflects updated state automatically

**Security Model**
- Tokens are scoped to specific user ID — cannot be used for other users
- Server-side generation ensures user identity validation before token issuance
- Client never handles API keys — only short-lived tokens

**Environment Variables**
- `WORKOS_API_KEY` — server-side authentication for token generation
- `WORKOS_CLIENT_ID` — identifies your application (optional for some widgets)

**Decision Point: When NOT to Use Widgets**
- If you need highly custom UI styling beyond theme configuration → build custom interface with User Management API
- If widget must be embedded in native mobile app → use API directly (widgets are web components)
- If user actions require complex workflow orchestration → use API for programmatic control

**Common Trap: Token Reuse**
Do NOT cache or reuse widget tokens across page loads. Generate fresh token each time component mounts — tokens are designed to be single-use and short-lived.

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-widgets.guide.md`

## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
