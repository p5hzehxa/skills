---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use this skill when you need to read directory data (users, groups) from a WorkOS-managed directory. This is a **read-only API** for querying synced identity data after a directory connection is established. If you need to set up the directory connection itself, use the Admin Portal or Directory Sync integration guides instead.

## Documentation

- https://workos.com/docs/reference/directory-sync
- https://workos.com/docs/reference/directory-sync/directory
- https://workos.com/docs/reference/directory-sync/directory-group
- https://workos.com/docs/reference/directory-sync/directory-group/get
- https://workos.com/docs/reference/directory-sync/directory-group/list

## Key Vocabulary

- **Directory** `directory_` — a synced identity provider connection (e.g., Okta, Google Workspace)
- **Directory User** `directory_user_` — a user record synced from the directory
- **Directory Group** `directory_group_` — a group record synced from the directory
- **Organization** `org_` — the WorkOS organization that owns the directory
- `WORKOS_API_KEY` — server-side authentication credential

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-directory-sync.guide.md`

## Related Skills

None — this is a foundational API skill with no cross-dependencies.
