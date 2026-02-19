---
name: workos-api-directory-sync
description: WorkOS Directory Sync API endpoints — directories, users, groups, and sync events.
---

<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use this API to read user and group data that WorkOS automatically syncs from identity providers like Okta, Azure AD, and Google Workspace. Reach for Directory Sync when you need to provision accounts, mirror org structures, or enforce group-based access control using an authoritative external directory as the source of truth.

## Key Concepts

**Core Resources**
- **Directory** — a connection to an identity provider (Okta, Azure AD, etc.) that continuously syncs users and groups
  - ID prefix: `directory_`
  - Each directory belongs to one organization (`organization_id`)
  - State field indicates sync health: `linked`, `unlinked`, `invalid_credentials`
- **Directory User** — a user record synced from the identity provider
  - ID prefix: `directory_user_`
  - Contains `emails[]`, `username`, `firstName`, `lastName`, `state` (active/inactive/suspended)
  - Groups field shows group memberships
- **Directory Group** — a group synced from the identity provider
  - ID prefix: `directory_group_`
  - Contains `name`, `raw_attributes` from the provider

**Pagination Pattern**
- List endpoints use `before`/`after` cursor pagination with `limit` (default 10, max 100)
- Response includes `list_metadata` with `before` and `after` cursors for traversing pages

**Filtering**
- Directory user list supports filtering by:
  - `directory` — filter users within a specific directory
  - `group` — filter users belonging to a specific group
  - `user` — search by username/email (partial match)
- Directory group list supports filtering by:
  - `directory` — filter groups within a specific directory
  - `user` — filter groups containing a specific user

**Webhook Events**
- Event types follow `dsync.{resource}.{action}` pattern
- Key events: `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.user_added`, `dsync.group.user_removed`
- Directory state changes emit `dsync.activated`, `dsync.deleted`

**Read-Only API**
- This API is strictly for READING synced data — you cannot create, update, or delete users/groups via the API
- All mutations happen in the identity provider and sync to WorkOS automatically

**Dashboard Navigation**
- View directories: WorkOS Dashboard → Directory Sync
- Each directory shows sync status, provider type, and last sync timestamp
- User/group data visible under each directory's detail page

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-directory-sync.guide.md`
