---
name: workos-migrate-auth0
description: Migrate to WorkOS from Auth0.
---

<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## When to Use

Use this when migrating an existing Auth0 tenant to WorkOS User Management. This skill covers the complete migration path: exporting user data from Auth0, transforming it to WorkOS format, importing via bulk User Provisioning API, and handling post-migration configuration. Critical for preserving user authentication continuity during platform transitions.

## Documentation

- https://workos.com/docs/migrate/auth0

## Key Concepts

**Migration Architecture**
- **Export → Transform → Import** pattern: Auth0 User Export Extension → data transformation → WorkOS bulk import
- **Password hash transfer**: Auth0 supports bcrypt hash export — WorkOS can accept these for seamless authentication continuity
- **Organization mapping**: Auth0 Organizations → WorkOS Organizations (requires matching org IDs during import)
- **Connection mapping**: Auth0 Connections → WorkOS Connections (must be configured in WorkOS before import)

**Auth0 Export Mechanics**
- **User Export Extension**: Auth0 Management Dashboard extension that generates JSON user dumps
- **Export scope**: includes user_id, email, email_verified, name, picture, identities array, app_metadata, user_metadata
- **Password hash availability**: bcrypt hashes included if "Export password hashes" is enabled
- **Rate limits**: Auth0 exports are throttled — large tenants may require batched exports

**WorkOS Import Requirements**
- **Bulk User Provisioning API**: `POST /user_management/users/bulk` endpoint for importing user batches
- **Required fields**: email, organization_id (if using organizations)
- **Optional fields**: email_verified, first_name, last_name, password_hash (bcrypt format)
- **Organization pre-creation**: organizations must exist in WorkOS before user import — use Directory Sync or Organizations API
- **Connection configuration**: SSO connections must be configured in WorkOS Dashboard before import if users rely on them

**Identity Mapping**
- **Auth0 identities array**: contains provider (e.g., "auth0", "google-oauth2"), user_id, connection
- **WorkOS identity mapping**: map Auth0 connection names to WorkOS connection_id values
- **Email-password users**: Auth0 "auth0" provider → WorkOS native authentication
- **SSO users**: Auth0 connection → WorkOS SSO connection (must match connection_id)

**Migration Traps**
- **Trap: importing users without organizations** — WorkOS requires organization_id if using Organizations; create orgs first
- **Trap: mismatched connection IDs** — Auth0 connection names ≠ WorkOS connection_id values; build explicit mapping
- **Trap: missing email verification flags** — preserve email_verified from Auth0 to avoid re-verification friction
- **Trap: password hash format mismatches** — verify bcrypt format is preserved; Auth0 may use different salt rounds

**Verification Commands**
```bash
# Verify Auth0 export includes password hashes
jq '.users[0] | has("password_hash")' auth0_export.json

# Count users by provider in Auth0 export
jq '[.users[].identities[].provider] | group_by(.) | map({provider: .[0], count: length})' auth0_export.json

# Verify WorkOS organization exists before import
curl -X GET https://api.workos.com/organizations/{org_id} \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Decision Trees**
- **Q: Can I preserve passwords?** → Yes if Auth0 export includes bcrypt hashes and WorkOS accepts them
- **Q: Should I migrate all users at once?** → No if tenant > 10k users; batch imports in chunks of 1k-5k
- **Q: Do I need to recreate organizations?** → Yes if using WorkOS Organizations; create before user import
- **Q: What about MFA settings?** → Auth0 MFA enrollment is not exported — users must re-enroll in WorkOS

**Related Skills**
- See `workos-user-management.summary.md` for WorkOS User Management concepts
- See `workos-organizations.summary.md` for Organization creation patterns
- See `workos-directory-sync.summary.md` for automated org provisioning

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-auth0.guide.md`
