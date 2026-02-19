---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use this skill when you need to automatically provision, update, and deprovision users and groups from an external identity provider (Google Workspace, Okta, Azure AD, etc.) into your application's database. Directory Sync keeps your user data in sync with the customer's authoritative source, eliminating manual user management and ensuring your application always reflects the current state of their organization.

## Documentation

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users

## Key Vocabulary

- **Directory** `directory_` — A connection to an identity provider's user/group data
- **User** `directory_user_` — An employee record synced from the directory
- **Group** `directory_group_` — An organizational unit or team synced from the directory
- **Event types**: `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`, `dsync.activated`, `dsync.deleted`
- **State attribute**: `active`, `inactive`, `suspended` — User lifecycle states
- **Events API** — Polling-based alternative to webhooks for batch processing or event recovery

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
