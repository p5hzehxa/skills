---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use this skill when you need to sync user and group data from external identity providers (Okta, Azure AD, Google Workspace) into your application. Directory Sync provides read-only access to organizational directory data through a unified API, eliminating the need to integrate with each provider separately.

## Documentation

- https://workos.com/docs/reference/directory-sync
- https://workos.com/docs/reference/directory-sync/directory
- https://workos.com/docs/reference/directory-sync/directory-group
- https://workos.com/docs/reference/directory-sync/directory-group/get
- https://workos.com/docs/reference/directory-sync/directory-group/list

## Key Vocabulary

- **Directory** `dir_` — a connected identity provider instance
- **Directory User** `directory_user_` — a user record synced from a directory
- **Directory Group** `directory_grp_` — a group record synced from a directory
- **Organization** `org_` — the WorkOS entity that owns a directory connection

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-directory-sync.guide.md`

## Related Skills

- `workos-directory-sync` — full Directory Sync implementation guide
