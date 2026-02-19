---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add a second authentication factor (TOTP, SMS) to your application's login flow, either as a standalone security layer or alongside SSO. MFA provides challenge-based verification after initial authentication, reducing account takeover risk.

## Documentation

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

## Key Vocabulary

- **Authentication Factor** `auth_factor_` — an enrolled TOTP or SMS device
- **Authentication Challenge** `auth_challenge_` — a time-limited verification request
- **Factor Types** — `totp` (authenticator app) or `sms` (phone number)
- **Challenge Event** `mfa_challenge_created` — webhook for new challenges

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
