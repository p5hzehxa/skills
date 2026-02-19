---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing AWS Cognito user pools to WorkOS User Management while preserving user accounts and authentication flows. Use this skill when transitioning from Cognito to WorkOS and you need to move users without requiring password resets. Note: AWS Cognito does not export password hashes, so password migration requires Just-In-Time (JIT) migration during user login.

## Documentation

- https://workos.com/docs/migrate/aws-cognito

## Key Vocabulary

- **Organization** `org_` — WorkOS tenant container for migrated users
- **User** `user_` — Migrated user entity in WorkOS
- **Connection** `conn_` — Authentication method configuration
- **Environment Variables** — `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`
- **JIT Migration** — Just-In-Time password verification pattern during first login
- **Cognito User Pool** — Source identity store in AWS
- **Cognito Client ID/Secret** — Credentials for programmatic Cognito access
- **User Attributes** — Metadata fields (email, name, custom attributes)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-aws-cognito.guide.md`
