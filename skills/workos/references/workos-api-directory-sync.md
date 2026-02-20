<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use Directory Sync when you need to provision and deprovision users and groups from enterprise identity providers (Okta, Azure AD, Google Workspace) into your application. This API handles the mapping between corporate directories and your app's user base, enabling automated onboarding and offboarding workflows.

## Key Vocabulary

- **Directory** `dir_` — represents a configured identity provider connection
- **Directory User** `directory_user_` — a user record synced from the identity provider
- **Directory Group** `directory_group_` — a group record synced from the identity provider
- **Webhook events** — `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.user_added`, `dsync.group.user_removed`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-directory-sync.guide.md`
