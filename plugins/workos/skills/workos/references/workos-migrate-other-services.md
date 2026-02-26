<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Migrate users from a custom authentication system or data store where you control password hash formats and user data structures. Use this when migrating from non-standard auth providers, legacy in-house systems, or services not covered by WorkOS's provider-specific guides.

## Key Vocabulary

- **User Management Organization** `org_` — the WorkOS org containing your user base
- **User** `user_` — migrated user identity with email and optional password hash
- **Password Hash** — bcrypt or Firebase scrypt format required for import
- **Email Verification** — user email confirmation state (verified/unverified)
- **Migration Token** — short-lived credential for user self-service password resets during cutover

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-other-services.guide.md`
