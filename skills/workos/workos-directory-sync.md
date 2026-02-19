---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use this skill when you need to import and continuously sync user/group data from enterprise identity providers (Okta, Azure AD, Google Workspace) into your application. Directory Sync maintains a local copy of organizational structure, enabling user provisioning, deprovisioning, and role mapping without requiring end-users to manually create accounts.

## Key Vocabulary

- **Directory** `directory_` — a connection to an identity provider's user/group data source
- **Directory User** `directory_user_` — a synced user record from the provider
- **Directory Group** `directory_group_` — a synced group/team record from the provider
- **Events API** — `workos.events.listEvents()` for batch processing and event recovery
- **Webhook events** — `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`, `dsync.group.created`, `dsync.group.updated`, `dsync.group.deleted`, `dsync.activated`, `dsync.deleted`
- **Primary email** — the `emails[0].value` field, guaranteed present on Directory Users
- **Dashboard path** — WorkOS Dashboard → Directories → [Select Directory] → Events / Users / Groups
- **Environment variables** — `WORKOS_API_KEY`, `WORKOS_WEBHOOK_SECRET`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
