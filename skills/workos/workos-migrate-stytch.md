---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Use this skill when migrating existing users and organizations from Stytch to WorkOS. This guide covers exporting data from Stytch's API, mapping Stytch constructs (members, organizations, MFA) to WorkOS equivalents, and preserving authentication state during the transition.

## Documentation

- https://workos.com/docs/migrate/stytch

## Key Vocabulary

- **Organization** `org_` — WorkOS organization entity (maps from Stytch organization)
- **User** `user_` — WorkOS user entity (maps from Stytch member)
- **Organization Membership** `org_membership_` — links users to organizations
- **Authentication Factor** `authentication_factor_` — WorkOS MFA factor (maps from Stytch authentication_factor)
- **Password Hash** `password_hash_` — WorkOS password hash entity
- **Email Verification** `email_verification_` — WorkOS email verification entity
- **Stytch Member** — source user entity in Stytch API
- **Stytch Organization** — source organization entity in Stytch API

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-stytch.guide.md`
