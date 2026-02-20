---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing user accounts from AWS Cognito User Pools to WorkOS Authentication. Use this when you need to preserve user credentials and metadata during a platform transition, or when consolidating authentication systems.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created during migration
- **Password Hash Migration** — Cognito does not export password hashes; users must reset passwords or use JIT migration
- **User Attributes** — Custom Cognito attributes mapped to WorkOS user metadata
- **JIT (Just-In-Time) Migration** — Migrate users on first login attempt using Cognito as fallback

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-aws-cognito.guide.md`

## Related Skills

- `workos-authkit-base` — Core authentication setup after migration
- `workos-user-management` — Managing migrated users in WorkOS
