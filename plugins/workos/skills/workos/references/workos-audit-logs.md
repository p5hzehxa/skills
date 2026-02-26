<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to export structured event logs for compliance, security monitoring, or user activity tracking. Audit Logs provide tamper-proof records of actions taken in your application, with filtering, pagination, and CSV export capabilities.

## Key Vocabulary

- **Event** `event_` — a single audit log entry with actor, target, action, and metadata
- **Actor** — the entity that performed the action (user, API key, system)
- **Target** — the resource affected by the action
- **Action** — the operation performed (e.g., `user.created`, `document.deleted`)
- **Organization** `org_` — the workspace or tenant scope for audit log events

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
