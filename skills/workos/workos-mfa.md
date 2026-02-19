---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add a second factor of authentication (TOTP, SMS) to an existing login flow. MFA is an add-on layer — it assumes you already have a primary authentication mechanism (passwords, SSO, OAuth). Reach for this when compliance or security policies require step-up authentication.

## Key Vocabulary

- **Authentication Factor** `authentication_factor_` — a registered MFA device (TOTP app, SMS number)
- **Challenge** `auth_challenge_` — a one-time verification request sent to a factor
- **Factor Type** — `totp` (authenticator apps like Google Authenticator, Authy) or `sms` (text message codes)
- **Enrollment** — the flow where a user registers a new MFA device (QR code scan for TOTP, phone number for SMS)
- **Verification** — the flow where a user proves possession of their factor by submitting a code
- **User ID** — your application's identifier for the user enrolling/verifying (required for factor association)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
