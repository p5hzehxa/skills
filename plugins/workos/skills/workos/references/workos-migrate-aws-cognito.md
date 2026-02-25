<!-- refined:sha256:643d575f22eb -->

# WorkOS Migration: AWS Cognito

## When to Use

Migrate existing AWS Cognito user pools to WorkOS when consolidating identity providers or moving to WorkOS AuthKit. This is a **bulk import** process — AWS Cognito does not export password hashes or MFA keys (Cognito platform limitation), so all migrated users must reset their password.

## Key Vocabulary

- **User Profile** `user_` — WorkOS user entity created via bulk import from Cognito user attributes
- **Organization** `org_` — WorkOS tenant structure (optional, for multi-tenant Cognito pools)
- **Password Reset Email** — WorkOS API endpoint to trigger forced password reset after migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-aws-cognito.guide.md`

## Related Skills

- `workos-authkit-nextjs` — integrate AuthKit post-migration (Next.js)
- `workos-authkit-react` — integrate AuthKit post-migration (React SPA)
- `workos-authkit-base` — core AuthKit concepts for any framework
