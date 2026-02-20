<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## When to Use

Use this skill when migrating an existing application from Clerk to WorkOS for authentication and user management. This migration preserves user identities, organization structures, and SSO connections without requiring users to re-authenticate or re-enroll.

## Key Vocabulary

- **User Migration** — bulk import of Clerk user records into WorkOS User Management
- **Organization `org_`** — WorkOS entity representing a tenant or workspace
- **Organization Membership `om_`** — links users to organizations with roles
- **Connection `conn_`** — SSO or Directory Sync configuration attached to an organization
- **Password Hash Import** — transferring bcrypt hashes from Clerk exports to preserve existing credentials

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-clerk.guide.md`
