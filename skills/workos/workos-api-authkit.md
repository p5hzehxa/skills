---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use this API reference when you need direct REST endpoint access for AuthKit features beyond what SDK wrappers provide. This includes low-level session management, custom authentication flows, API key operations, and programmatic user/organization membership control. Reach for this when framework-specific AuthKit skills (React, Next.js, etc.) don't expose the exact endpoint you need.

## Documentation

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization

## Key Vocabulary

- **User** `user_` — end-user identity entity
- **Session** `session_` — authenticated user session
- **Organization Membership** `om_` — user-to-organization relationship
- **Invitation** `invitation_` — pending organization invite
- **Magic Auth** `magic_auth_` — passwordless authentication code
- **Email Verification** `email_verification_` — email confirmation token
- **Authentication Factor** `auth_factor_` — MFA enrollment record
- **Authentication Challenge** `auth_challenge_` — MFA verification attempt
- **Password Reset** `password_reset_` — password recovery token

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-authkit.guide.md`

## Related Skills

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
- workos-authkit-base
