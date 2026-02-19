---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Use this skill when migrating an existing authentication system from Stytch to WorkOS. This guide covers user data export from Stytch, mapping Stytch concepts to WorkOS equivalents (users, organizations, sessions), and handling differences in authentication flows and password management.

## Documentation

- https://workos.com/docs/migrate/stytch

## Key Concepts

### Stytch → WorkOS Mapping
- **Stytch Organizations** → WorkOS Organizations (`org_`)
- **Stytch Members** → WorkOS Organization Memberships
- **Stytch Projects** → WorkOS Environments (dev/staging/prod)
- **Stytch Sessions** → WorkOS Sessions (requires re-authentication)

### ID Prefixes
- WorkOS User IDs: `user_`
- WorkOS Organization IDs: `org_`
- WorkOS Connection IDs: `conn_` (for SSO)

### Critical Differences
- **Password hashes**: Stytch uses bcrypt/scrypt — WorkOS does NOT import password hashes. Users must reset passwords or use passwordless auth on first login.
- **Session migration**: Stytch sessions cannot be transferred. Plan for forced re-authentication during cutover.
- **MFA settings**: Stytch MFA enrollments do NOT carry over. Users must re-enroll in WorkOS.
- **Email verification status**: Preserve `email_verified` flag during user import via User Management API.

### Organization Migration Pattern
1. Export Stytch organizations via API
2. Create WorkOS organizations with matching `external_id` (your Stytch org ID)
3. Create organization memberships for each member
4. Map Stytch roles to WorkOS role slugs (custom roles must be defined first)

### Authentication Flow Changes
- **Magic links**: Stytch magic links → WorkOS Magic Auth (different URL structure)
- **OAuth providers**: Re-configure OAuth apps with WorkOS redirect URLs
- **SSO connections**: SAML/OIDC connections must be recreated in WorkOS Dashboard

### Verification Commands
```bash
# Confirm user import succeeded
curl -X GET "https://api.workos.com/users?organization_id=org_..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Verify organization membership count
curl -X GET "https://api.workos.com/user_management/organization_memberships?organization_id=org_..." \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### Migration Traps
- **Do NOT assume password portability** — Stytch's hashing is incompatible with WorkOS. Design for password reset flow.
- **Do NOT migrate during business hours** — session invalidation will force all users to re-authenticate.
- **Do NOT skip email verification sync** — unverified Stytch emails should remain unverified in WorkOS.
- Test the full authentication flow in a staging environment with real Stytch export data before production cutover.

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-stytch.guide.md`
