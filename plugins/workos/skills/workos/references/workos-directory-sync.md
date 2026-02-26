<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use this skill when you need to sync user and group data from external identity providers (Okta, Microsoft Entra ID, Google Workspace, etc.) into your application. Directory Sync solves the problem of keeping user rosters, organizational structures, and group memberships automatically synchronized without manual CSV imports or API polling.

## Key Vocabulary

- **Directory** `directory_` — represents a configured sync connection to an identity provider
- **Directory User** `directory_user_` — a synced user entity from the identity provider
- **Directory Group** `directory_group_` — a synced group/team entity from the identity provider
- **dsync.\*** events — webhook event types for user/group lifecycle (`dsync.user.created`, `dsync.group.updated`, `dsync.deleted`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
