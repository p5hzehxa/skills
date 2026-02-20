<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add a second authentication factor to your application after a user's primary authentication. MFA protects user accounts by requiring both something the user knows (password) and something they have (device) before granting access.

## Key Vocabulary

- **Authentication Factor** `auth_factor_` — a registered MFA method (SMS or TOTP)
- **Challenge** `auth_challenge_` — a verification request sent to the user's factor
- **Factor Types**: `sms` (phone-based codes) and `totp` (authenticator app codes)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
