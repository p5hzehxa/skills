<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## When to Use

Use this skill when you need to manage organizations in WorkOS — creating, reading, updating, or deleting organization records. This is the core entity for multi-tenant applications and is required when implementing Admin Portal, Directory Sync, or SSO connections that belong to specific organizations.

## Key Vocabulary

- **Organization** `org_` — The top-level multi-tenant entity in WorkOS
- **External ID** — Your system's unique identifier for an organization (used for lookups)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-organization.guide.md`

## Related Skills

- workos-admin-portal (organizations own Admin Portal sessions)
- workos-sso (SSO connections belong to organizations)
- workos-directory-sync (directory connections belong to organizations)
