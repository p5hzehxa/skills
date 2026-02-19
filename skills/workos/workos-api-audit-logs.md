---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use this skill when you need to create tamper-proof audit trails for compliance, security investigations, or user activity tracking. It covers programmatic event creation, schema management, CSV exports for external analysis, and retention policy configuration. Choose this over raw event logging when you need queryable, structured audit data with actor/target/context metadata.

## Documentation

- https://workos.com/docs/reference/audit-logs
- https://workos.com/docs/reference/audit-logs/configuration
- https://workos.com/docs/reference/audit-logs/event
- https://workos.com/docs/reference/audit-logs/event/create
- https://workos.com/docs/reference/audit-logs/export

## Key Vocabulary

- **Organization** `org_` — container for audit events and schema
- **Event** — immutable audit log entry with `action`, `actor`, `target`, `context`, `occurred_at`
- **Schema** — defines valid action types for an organization
- **Action** — categorized operation (e.g., `user.login_failed`, `document.deleted`)
- **Actor** — entity performing the action (user, service account, system)
- **Target** — entity being acted upon (resource, document, setting)
- **Export** `audit_log_export_` — CSV snapshot of events for a time range
- **Retention Policy** — automatic deletion rule for old events (90/180/365/730 days)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-audit-logs.guide.md`

## Related Skills

- workos-authkit-base — for capturing authentication events as audit log actors
- workos-directory-sync — for syncing directory user changes into audit trails
