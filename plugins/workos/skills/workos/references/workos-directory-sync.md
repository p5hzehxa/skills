<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use Directory Sync when you need to provision user accounts and groups from identity providers (Okta, Azure AD, Google Workspace) into your application. This skill handles both real-time webhook-based sync and batch processing via the Events API. Choose webhooks for immediate provisioning; choose Events API for reconciliation, recovery, or batch imports.

## Key Vocabulary

- **Directory** `directory_` — represents a sync connection to an IdP
- **Directory User** `directory_user_` — synced user account from the IdP
- **Directory Group** `directory_group_` — synced group from the IdP
- **Event types**: `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`, `dsync.group.user_added`, `dsync.group.user_removed`
- **`dsync.deleted`** — triggered when entire Directory is deactivated (does NOT trigger individual user/group delete events)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
