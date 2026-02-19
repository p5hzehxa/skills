---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## When to Use

Use this when migrating an existing Descope authentication system to WorkOS. This skill covers exporting user data from Descope (via Management API or Dashboard CSV), transforming it to match WorkOS's import format, and bulk-importing users while preserving their authentication credentials. Choose this over manual user creation when you need to migrate more than a handful of users or preserve existing user identities.

## Documentation

- https://workos.com/docs/migrate/descope

## Key Concepts

### Migration Strategy Decision Tree
- **Password export supported**: Descope can export password hashes via Management API (requires Descope Pro plan or higher)
- **Hash algorithm**: Descope uses bcrypt hashes, which WorkOS supports directly — no re-hashing required
- **Two-phase approach**: Export from Descope → Transform to WorkOS format → Bulk import via User Management API

### Descope Export Methods
- **Management API export** (recommended): Programmatic user data export including password hashes
- **Dashboard CSV export** (fallback): Manual download from Descope Dashboard — does NOT include password hashes
- **Export scope**: users, email addresses, metadata, and (conditionally) password hashes

### WorkOS User Management Concepts
- **Organization context**: Decide whether to migrate users into WorkOS Organizations or as standalone users
- **Organization ID format**: `org_` prefix (e.g., `org_01HYZC4PJVBK39M3R2T8G7Z8X0`)
- **Bulk import method**: Use `userManagement.createUser` in a loop — WorkOS does not provide a dedicated batch endpoint
- **Email uniqueness**: WorkOS enforces unique emails within an organization
- **Password import**: Provide `{ hash: string, hashType: 'bcrypt' }` in the create request

### Descope-Specific Limitations
- **No SSO connection migration**: Descope SSO configurations must be manually recreated in WorkOS
- **No MFA settings migration**: Users must re-enroll in MFA after migration
- **Metadata mapping**: Descope custom attributes → WorkOS user `metadata` field (flat JSON object)

### Environment Variables
- `WORKOS_API_KEY`: Your WorkOS secret key (starts with `sk_`)
- `DESCOPE_PROJECT_ID`: Your Descope project identifier
- `DESCOPE_MANAGEMENT_KEY`: API key for Descope Management API access

### Common Migration Pitfalls
- **CSV export trap**: Dashboard CSV does NOT include password hashes — users will need to reset passwords. Use Management API instead.
- **Rate limiting**: WorkOS User Management API has standard rate limits — implement exponential backoff for large user sets
- **Hash verification**: Confirm bcrypt hash format before import — malformed hashes will cause import failures

### Verification Checkpoints
- Confirm Descope export includes expected user count
- Validate transformed data matches WorkOS User schema before bulk import
- Test authentication with a migrated user before completing full migration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-descope.guide.md`

## Related Skills

- `workos-user-management` — Core User Management API operations
- `workos-organizations` — Organization structure and management
- `workos-migrate-auth0` — Similar migration pattern for Auth0
- `workos-migrate-firebase` — Similar migration pattern for Firebase Auth
