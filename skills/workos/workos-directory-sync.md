---
name: workos-directory-sync
description: Sync user directories from identity providers like Okta, Azure AD, and Google.
---

<!-- refined:sha256:a3a31bdb28d7 -->

# WorkOS Directory Sync

## When to Use

Use this skill when you need to automatically provision and deprovision users based on changes in an external identity provider (Okta, Azure AD, Google, etc.). Directory Sync keeps your application's user database in sync with an organization's central directory — when an admin adds/removes users or changes group memberships in their IdP, those changes propagate to your app via events. This is essential for enterprise customers who need centralized user management and automated offboarding.

## Documentation

- https://workos.com/docs/directory-sync/understanding-events
- https://workos.com/docs/directory-sync/quick-start
- https://workos.com/docs/directory-sync/index
- https://workos.com/docs/directory-sync/identity-provider-role-assignment
- https://workos.com/docs/directory-sync/handle-inactive-users

## Key Concepts

### Core Entities
- **Directory**: represents a connection to a specific IdP for a specific organization (identified by `directory_id`, prefix `directory_`)
- **Directory User**: a user record synced from the IdP (identified by `id`, no special prefix; has `idp_id` from source system)
- **Directory Group**: a group/team from the IdP (identified by `id`, no special prefix; has `idp_id` from source system)
- **Organization**: the WorkOS entity that owns directories (you link directories to organizations when setting up)

### Event System
- **Event types follow pattern**: `dsync.{resource}.{action}` (e.g., `dsync.user.created`, `dsync.group.updated`, `dsync.activated`)
- **Webhook delivery**: real-time push notifications sent to your configured endpoint (return `200` immediately, process async)
- **Events API**: alternative polling-based approach using `workos.events.listEvents()` — useful for batch processing, reconciliation, or recovering missed events
- **Both methods are supported**: webhooks (recommended, real-time) OR Events API (polling). Choose based on your architecture.

### Critical Trap: dsync.deleted
- When a directory connection is deleted (`dsync.deleted` event), you do NOT receive individual `dsync.user.deleted` or `dsync.group.deleted` events for each user/group
- You must query all users/groups for that `directory_id` and deprovision them yourself
- This is the most common integration bug — handle `dsync.deleted` explicitly

### State Management
- **User/Group states**: `active`, `inactive` (suspended in IdP but not deleted)
- **Inactive handling**: decide whether to soft-delete (mark as disabled) or hard-delete (remove from DB) when `state: 'inactive'`
- **Idempotency**: use `idp_id` as the unique key for upserts — events may arrive out of order or duplicate

### Role Mapping
- **IdP groups → app roles**: map directory group names to application role slugs
- **Role assignment patterns**: either assign roles based on group membership OR use custom attributes if IdP supports them
- Check fetched docs for provider-specific attribute support

### Dashboard Navigation
- WorkOS Dashboard → Organizations → [Select Org] → Directory Sync → Configure directory connection
- Test events in Dashboard → Directory Sync → [Select Directory] → Events tab

### Environment Variables
- `WORKOS_API_KEY`: your API key (prefix `sk_`)
- `WORKOS_WEBHOOK_SECRET`: used to verify webhook signatures (prefix `whs_`)

### Webhook Security
- Always verify webhook signatures using `workos.webhooks.constructEvent()` or equivalent before processing
- Return `200` status immediately after signature verification — process events asynchronously
- Store raw webhook payload for debugging before processing

### Verification Commands
```bash
# Verify webhook signature (example pattern — check SDK docs for exact method)
# This confirms your endpoint correctly validates incoming webhooks

# List directories for an organization
workos-cli directories list --organization-id org_123

# List users in a directory
workos-cli directory-users list --directory-id directory_456

# Check recent events
workos-cli events list --limit 10
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-directory-sync.guide.md`

## Related Skills

- **workos-sso**: Single Sign-On configuration
- **workos-integrations**: Provider-specific directory setup
