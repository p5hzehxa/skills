---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use Directory Sync when your application needs to automatically provision, update, or deprovision users and groups from an organization's identity provider (Azure AD, Okta, Google Workspace, etc.). This enables workforce identity management at scale — employees added in the IdP appear in your app without manual CSV imports or API calls.

## Documentation

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users

## Key Vocabulary

- **Directory** `directory_` — represents a synced identity provider connection
- **User** `directory_user_` — synced employee record from the IdP
- **Group** `directory_group_` — synced team/role container from the IdP
- **Event types**: `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`, `dsync.group.user_added`, `dsync.group.user_removed`, `dsync.activated`, `dsync.deleted`
- **Directory state**: `linked`, `unlinked`, `invalid_credentials`
- **User state**: `active`, `inactive`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
