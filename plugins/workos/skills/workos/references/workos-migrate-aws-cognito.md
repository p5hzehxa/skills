<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing user accounts from AWS Cognito User Pools to WorkOS authentication. Use this when you want to preserve user identities during a platform transition, but note that AWS Cognito does not export password hashes or MFA keys—migrated users must reset their passwords.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created via Create User API
- **Environment `environment_`** — WorkOS environment ID where users are imported
- **Directory `directory_`** — optional WorkOS directory for organizational mapping
- **Password Reset Email** — proactive workflow via Send Password Reset Email API
- **JIT (Just-In-Time) migration** — NOT supported for Cognito (no password verification endpoint)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-aws-cognito.guide.md`
