---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add a second authentication factor (TOTP, SMS) to an existing authentication system. This is NOT a standalone auth solution — it adds MFA on top of your primary authentication (email/password, SSO, etc.). Choose this when compliance or security policy requires step-up verification beyond username/password.

## Documentation

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

## Key Vocabulary

- **Authentication Factor** `authentication_factor_` — represents an enrolled MFA method (TOTP or SMS)
- **Authentication Challenge** `auth_challenge_` — a pending verification attempt tied to a factor
- **Factor types**: `totp` (authenticator app) or `sms` (phone number)
- **Enrollment flow** — user registers a new factor (QR code for TOTP, phone for SMS)
- **Challenge/verify pattern** — generate challenge → user submits code → verify challenge
- **`WORKOS_API_KEY`** — server-side credential for WorkOS API calls
- **`WORKOS_CLIENT_ID`** — identifies your WorkOS application environment

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
