<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add time-based one-time passwords (TOTP) or SMS-based second-factor authentication to your application. MFA adds a verification step after primary authentication, requiring users to prove possession of a registered device. Reach for this when your security requirements mandate two-factor flows beyond username/password.

## Key Vocabulary

- **Authentication Factor** `auth_factor_` — a registered MFA method (TOTP app or SMS phone number)
- **Challenge** `auth_challenge_` — a verification attempt initiated after primary auth
- **Factor Type** — either `totp` (authenticator app) or `sms` (text message code)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
