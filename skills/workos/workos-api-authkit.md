---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use the AuthKit API when building custom authentication flows that require direct API control beyond the hosted UI (e.g., headless authentication, CLI tools, or native mobile apps). This API provides endpoints for user management, session handling, MFA enrollment, and token operations. For standard web applications, prefer the AuthKit SDKs (`workos-authkit-react`, `workos-authkit-nextjs`) which wrap these APIs.

## Key Vocabulary

- User `user_` — identity record with email, authentication methods
- Session `session_` — authenticated user session with access/refresh tokens
- Organization Membership `om_` — links users to organizations with roles
- Invitation `invitation_` — pending organization membership invitation
- Magic Auth `magic_auth_` — passwordless email link authentication
- Email Verification `email_verification_` — email ownership confirmation token
- Password Reset `password_reset_` — password change request token
- Authentication Factor `auth_factor_` — enrolled MFA method (TOTP, SMS)
- Authentication Challenge `auth_challenge_` — MFA verification attempt
- API Key `sk_` (secret), `pk_` (publishable) — client authentication credentials

## Documentation

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/authentication
- https://workos.com/docs/reference/authkit/user
- https://workos.com/docs/reference/authkit/session
- https://workos.com/docs/reference/authkit/mfa
- https://workos.com/docs/reference/authkit/organization-membership
- https://workos.com/docs/reference/authkit/invitation
- https://workos.com/docs/reference/authkit/magic-auth
- https://workos.com/docs/reference/authkit/password-reset
- https://workos.com/docs/reference/authkit/email-verification
- https://workos.com/docs/reference/authkit/cli-auth

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-authkit.guide.md`

## Related Skills

- `workos-authkit-react` — React SDK wrapping these APIs
- `workos-authkit-nextjs` — Next.js SDK with server-side session handling
- `workos-authkit-vanilla-js` — Vanilla JS SDK for browser-based flows
