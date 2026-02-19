---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing AWS Cognito user pools to WorkOS User Management when consolidating identity providers or switching auth systems. Use this skill when you need to preserve user identities, handle Cognito's export limitations (no password hash exports), and implement JIT password migration flows.

## Documentation

- https://workos.com/docs/migrate/aws-cognito

## Key Vocabulary

- **User** `user_` — WorkOS identity entity created during migration
- **Organization** `org_` — workspace container for migrated enterprise users
- **Password Hash** — NOT exported by Cognito; requires JIT migration flow
- **JIT Migration** — just-in-time password capture during first WorkOS login
- **User Pool** — source Cognito container for users being migrated
- **MFA Settings** — must be reconfigured in WorkOS (not migrated automatically)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-aws-cognito.guide.md`

## Related Skills

- `workos-user-management` — target system for migrated Cognito users
- `workos-mfa` — reconfigure MFA after migration (Cognito MFA settings don't transfer)
