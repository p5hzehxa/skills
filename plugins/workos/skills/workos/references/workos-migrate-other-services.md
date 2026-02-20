<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Use this skill when migrating users from a custom authentication system or database to WorkOS. This guide covers exporting user data from your own data store and importing it into WorkOS User Management, including password hash handling and field mapping strategies.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created during import
- **Password Hash** — exported credential data requiring transformation for WorkOS compatibility
- **Email Verification Status** — user email confirmation state preserved during migration
- **Profile Attributes** — custom user metadata fields mapped during import
- **Bulk Import** — batch user creation operation for migration scenarios

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-other-services.guide.md`
