---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use this API reference when you need to directly call WorkOS AuthKit endpoints for authentication flows, user management, session handling, MFA enrollment, or API key operations. This is the low-level HTTP API — prefer SDK wrappers (covered in related skills) unless you need raw endpoint access or are building custom integrations.

## Documentation

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization

## Key Vocabulary

- **User** `user_` — end-user identity with email, name, and profile metadata
- **Session** `session_` — authenticated session with access/refresh tokens
- **Organization Membership** `om_` — links users to organizations with role data
- **Invitation** `invitation_` — pending org membership invite sent via email
- **Magic Auth** `magic_auth_` — passwordless email link authentication flow
- **Authentication Factor** `auth_factor_` — enrolled MFA method (TOTP, SMS)
- **Authentication Challenge** `auth_challenge_` — MFA verification prompt
- **Email Verification** `email_verification_` — confirmation flow for new emails
- **Password Reset** `password_reset_` — time-limited password change token
- **API Key** `sk_` (secret) or `pk_` (publishable) — authentication credentials

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-authkit.guide.md`

## Related Skills

- workos-authkit-base
- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
