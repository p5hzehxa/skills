---
name: workos-migrate-other-services
description: Migrate to WorkOS from other services.
---

<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: other services

## When to Use

Use this skill when migrating users from a custom authentication system, in-house user database, or any identity provider not covered by WorkOS's provider-specific migration guides. This is the fallback migration path when you control the source data format and need to map it to WorkOS's User Management API.

## Documentation

- https://workos.com/docs/migrate/other-services

## Key Concepts

### Migration Strategy Decision Tree

**Password Handling**: Choose one based on your source system's capabilities:
- **Preserve existing passwords**: If your system exports password hashes that WorkOS supports (bcrypt, Firebase scrypt, MD5, PBKDF2, standard scrypt), import them directly. WorkOS will authenticate users with their existing passwords.
- **Force password reset**: If your system uses unsupported hash algorithms or doesn't export hashes, import users without passwords and trigger password reset flows.
- **Defer authentication to existing system**: Keep your auth system running temporarily and use WorkOS as the authorization layer until you can migrate passwords.

**Field Mapping**: Map your data schema to WorkOS's user object structure:
- **Required fields**: `email` (unique identifier)
- **Optional profile fields**: `firstName`, `lastName`, `emailVerified`
- **Custom metadata**: Use `profileMetadata` for any fields WorkOS doesn't have first-class support for (e.g., phone numbers, custom flags, legacy user IDs)

**Cutover Strategy**: Choose based on risk tolerance and rollback requirements:
- **Big bang migration**: Export all users, import to WorkOS, switch authentication in one deployment. Fastest but higher rollback complexity.
- **Gradual migration**: Migrate user cohorts over time, keeping dual authentication temporarily. Safer but requires running two systems.
- **Read-only trial**: Import users with force-reset passwords to test data mapping without changing authentication behavior.

### Structural Vocabulary

- **User object**: WorkOS's representation of an authenticated user with fields like `email`, `emailVerified`, `firstName`, `lastName`
- **Profile metadata**: Arbitrary JSON object for storing custom user attributes that don't map to WorkOS's first-class fields
- **Organization**: Optional grouping for multi-tenant applications — users can belong to organizations
- **Email verification state**: Controls whether WorkOS requires email verification before allowing authentication

### Critical Traps

**Password hash validation**: WorkOS validates hash format during import. If your system exports hashes in a format WorkOS doesn't recognize, the import will fail. Check supported algorithms in fetched docs BEFORE starting the export.

**Email uniqueness**: WorkOS enforces unique emails across the entire environment. If your source system allows duplicate emails (e.g., same email in different tenants), you must handle deduplication or use organizationId scoping.

**No rollback of authentication changes**: Once you switch authentication to WorkOS and users start changing passwords, you can't easily roll back. Plan cutover carefully.

**Case sensitivity**: WorkOS treats emails as case-insensitive for authentication but preserves original casing. Ensure your source data doesn't have case-only duplicates (e.g., `user@example.com` and `User@example.com`).

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-other-services.guide.md`

## Related Skills

- `workos-user-management` — understanding WorkOS user objects and profile metadata structure
- `workos-organizations` — if migrating multi-tenant systems where users belong to organizations
