---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use this skill when you need to read directory data (users, groups) synced from identity providers like Okta, Azure AD, or Google Workspace. This is a read-only API — WorkOS handles the sync from the provider; you fetch the cached directory state. Use when you need org member lists, group memberships, or profile attributes for provisioning/deprovisioning workflows.

## Key Vocabulary

- **Directory** `directory_` — a synced identity provider connection (one per org)
- **Directory User** `directory_user_` — a synced user record with email, username, profile data
- **Directory Group** `directory_group_` — a synced group with member references
- **Organization** `org_` — the WorkOS entity owning the directory
- **State** — directory lifecycle: `linked`, `unlinked`, `invalid_credentials`, `deleting`
- **Type** — provider identifier: `azure scim v2.0`, `okta scim v2.0`, `generic scim v2.0`, etc.
- **Primary Email** — the canonical email field for a directory user (vs raw SCIM attributes)
- **Raw Attributes** — unprocessed SCIM payload from the provider (JSON object)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-directory-sync.guide.md`

## Related Skills

- `workos-directory-sync` — webhook events and sync lifecycle
- `workos-user-management` — creating WorkOS users from directory data
