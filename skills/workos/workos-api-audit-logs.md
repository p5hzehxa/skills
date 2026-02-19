---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use this skill when you need to emit, query, or export audit trail events for compliance or security monitoring. It covers event creation, schema management, export generation, and retention policies. If you need to display audit logs in a user-facing UI, see the Audit Log Streams skill instead.

## Documentation

- https://workos.com/docs/reference/audit-logs
- https://workos.com/docs/reference/audit-logs/configuration
- https://workos.com/docs/reference/audit-logs/event
- https://workos.com/docs/reference/audit-logs/event/create
- https://workos.com/docs/reference/audit-logs/export

## Key Vocabulary

- **Organization** `org_` — tenant container for audit events
- **Actor** — entity performing the audited action (user, system, API key)
- **Target** — entity being acted upon (resource, user, configuration)
- **Action** — standardized verb describing the event (e.g., `user.created`, `document.deleted`)
- **Schema** — defines allowed actions and metadata structure for an organization
- **Export** `audit_log_export_` — bulk CSV download of filtered events
- **Retention Policy** — configures how long events are stored (default 1 year)
- **Context** — additional metadata fields (IP, user agent, location)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-audit-logs.guide.md`

## Related Skills

None
