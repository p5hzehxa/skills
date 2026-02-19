---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing user accounts from AWS Cognito User Pools to WorkOS Authentication. Use this when deprecating Cognito infrastructure or consolidating identity providers. Migration preserves user identities without forcing password resets (where Cognito exports support it).

## Key Vocabulary

- **User Pool** — Cognito's user directory container; maps to a WorkOS Organization
- **Organization `org_`** — WorkOS container for migrated users
- **Connection `conn_`** — WorkOS authentication method linking to the Organization
- **Password Hash Migration** — limited by Cognito's export capabilities (Cognito does not export password hashes)
- **JIT (Just-In-Time) Migration** — migrating users on first login attempt via custom authentication flow
- **Bulk Migration** — pre-migrating user records via CSV export/import
- **User Attributes** — Cognito user metadata (email, phone, custom attributes); map to WorkOS user profile fields
- **MFA Settings** — Cognito's multi-factor authentication state; requires re-enrollment in WorkOS
- **Lambda Triggers** — Cognito's custom authentication hooks; replacement patterns differ in WorkOS

## Documentation

- https://workos.com/docs/migrate/aws-cognito

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-aws-cognito.guide.md`

## Related Skills

- workos-authkit-nextjs — for post-migration authentication UI
- workos-user-management — for managing migrated user accounts
