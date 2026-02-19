---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## When to Use

Use this skill when you need to add a second authentication factor (TOTP authenticator apps or SMS codes) to an existing authentication system. MFA protects high-value actions like login, account changes, or transaction approval by requiring users to prove they possess a registered device. WorkOS MFA works standalone or alongside AuthKit/SSO — add it to any authentication flow where you control the primary credential check.

## Documentation

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

## Key Concepts

**Core Resources**
- **Authentication Factor** — a registered MFA method (TOTP or SMS) identified by `auth_factor_<id>`
- **Authentication Challenge** — a verification attempt identified by `auth_challenge_<id>`, created when a user needs to prove possession of a factor
- **Factor Types** — `totp` (authenticator apps like Google Authenticator, 1Password, Authy) or `sms` (text message codes)

**Enrollment Flow Pattern**
1. Call `client.mfa.enrollFactor()` with user ID and factor type
2. Present QR code (TOTP) or send SMS (SMS) to user
3. User enters code from their device
4. Call `client.mfa.challengeFactor()` to verify enrollment code
5. Store `auth_factor_<id>` with user record for future challenges

**Challenge Flow Pattern**
1. After primary authentication succeeds, call `client.mfa.challengeFactor(authFactorId)` to issue a challenge
2. Present code entry UI to user
3. User enters code from their device
4. Call `client.mfa.verifyChallenge(authChallengeId, code)` to validate
5. On success, complete session creation — treat failed verification like a failed login

**ID Prefixes**
- `auth_factor_` — enrolled MFA factors
- `auth_challenge_` — active verification challenges

**Environment Variables**
- `WORKOS_API_KEY` — your secret API key (starts with `sk_`)

**Decision Points**
- **TOTP vs SMS** — TOTP is more secure (no SMS interception) but requires users to install an app; SMS works with any phone but costs per message and has delivery delays
- **Enrollment timing** — enroll during signup for mandatory MFA, or offer opt-in enrollment in account settings for progressive security
- **Challenge scope** — challenge on every login for maximum security, or use remember-me cookies to challenge only on new devices (you implement cookie logic)

**Integration Traps**
- Do NOT create a new challenge for retry attempts — reuse the same `auth_challenge_<id>` until it expires or succeeds
- Do NOT store MFA codes server-side — WorkOS validates them, you only pass them through
- Factor deletion is immediate — if a user loses their device and you delete their factor, they cannot recover it (build account recovery flows)

**Verification Commands**
```bash
# List all factors for a user (check enrollment worked)
curl https://api.workos.com/user_management/users/{user_id}/auth_factors \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Verify API key is valid
curl https://api.workos.com/mfa/factors \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-mfa.guide.md`

## Related Skills

- **workos-sso**: SSO for primary authentication
