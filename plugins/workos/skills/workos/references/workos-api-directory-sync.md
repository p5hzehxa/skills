<!-- refined:sha256:6a702a85e175 -->

# WorkOS Directory Sync API Reference

## When to Use

Use Directory Sync when you need to provision and manage user identities from an enterprise identity provider (Azure AD, Okta, Google Workspace) into your application. This API surfaces users, groups, and their memberships synced from the customer's directory system, allowing you to keep your app's user base in sync with their authoritative source of truth.

## Key Vocabulary

- **Directory `dir_`** — a configured connection to an identity provider (Azure AD, Okta, etc.)
- **Directory User `directory_user_`** — a user record synced from the customer's directory
- **Directory Group `directory_grp_`** — a group record synced from the customer's directory
- **Event types** — `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-directory-sync.guide.md`

## Related Skills

- **workos-authkit-base** — for authenticating synced users after they're provisioned
