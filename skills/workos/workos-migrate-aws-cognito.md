---
name: workos-migrate-aws-cognito
description: Migrate to WorkOS from AWS Cognito.
---

<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Use this when migrating an existing AWS Cognito user base to WorkOS authentication. This covers both JIT (just-in-time) migration during user login and bulk user import via CSV. Choose JIT migration when you want to preserve user passwords without re-authentication; choose bulk import when passwords cannot be migrated (Cognito does not export password hashes) or for a one-time transfer.

## Key Concepts

**Migration Strategies**
- **JIT Migration** — migrate users on first login by validating credentials against Cognito, then creating WorkOS user
- **Bulk Import** — export users to CSV, import to WorkOS, require password reset (Cognito limitation: no password hash export)

**Cognito Identifiers**
- User Pool ID format: `us-east-1_aBcDeFgHi`
- Region: required for API calls (e.g., `us-east-1`)
- App Client ID: OAuth client ID for authenticating users

**WorkOS Concepts**
- Organization: maps to a Cognito User Pool or tenant boundary
- Connection: not used for password-based migration (no SSO handoff)
- Email verification: WorkOS re-verifies emails by default unless `email_verified: true` in CSV

**Migration Webhooks**
- Event type: `authentication.email_verification_succeeded` — listen to trigger JIT lookup
- Webhook signature verification: use `workos.webhooks.verifyEvent()` to confirm authenticity
- Return 200 immediately, defer long-running Cognito API calls to background jobs

**CSV Import Format**
- Required columns: `email`, `email_verified`, `first_name`, `last_name`
- Optional: custom attributes map to WorkOS profile metadata
- Password column: omit (Cognito does not export hashes)

**Cognito API Operations**
- `AdminGetUser` — fetch user details during JIT migration
- `AdminInitiateAuth` — validate username/password (returns tokens on success)
- AWS SDK required: `@aws-sdk/client-cognito-identity-provider`

**Common Traps**
- Cognito does NOT export password hashes — bulk import always requires password reset
- Do NOT confuse Cognito's lack of hash export with WorkOS's ability to import hashes (WorkOS supports bcrypt/scrypt if the source provides them)
- JIT migration must validate passwords against Cognito in real-time — no offline fallback
- Cognito rate limits: 25 requests/second per user pool — implement exponential backoff

**Decision Tree: JIT vs Bulk**
- Use JIT if: passwords must survive migration, user base is active, you can defer full migration
- Use Bulk if: one-time cutover required, user re-authentication acceptable, Cognito deprecation deadline is near

**Verification Commands**
```bash
# Verify Cognito credentials
aws cognito-idp admin-get-user --user-pool-id <pool_id> --username <email> --region <region>

# Test WorkOS user creation
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","email_verified":true}'
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-aws-cognito.guide.md`
