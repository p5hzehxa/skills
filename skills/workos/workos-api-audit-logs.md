---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use the Audit Logs API to programmatically emit audit events from your application, configure event schemas, and manage data exports. This is a direct API alternative to WorkOS SDKs when you need raw HTTP control or are building custom integrations for compliance logging.

## Key Vocabulary

- **Audit Event** — a logged action with actor, target, context, and timestamp
- **Event Schema** — defines action types and their display metadata
- **Export** — CSV download of filtered audit log data
- **Retention Policy** — how long audit events are stored (30-3650 days)
- Event ID prefix: `audit_log_event_`
- Export ID prefix: `audit_log_export_`
- Actor ID prefix: `user_` (your system's user identifier)
- Target ID prefix: application-defined (e.g., `project_`, `document_`)
- Organization ID prefix: `org_` (WorkOS organization identifier)

## Documentation

- https://workos.com/docs/reference/audit-logs
- https://workos.com/docs/reference/audit-logs/configuration
- https://workos.com/docs/reference/audit-logs/event
- https://workos.com/docs/reference/audit-logs/event/create
- https://workos.com/docs/reference/audit-logs/export

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-audit-logs.guide.md`

## Related Skills

- `workos-audit-logs` — SDK-based audit log implementation (higher-level)
- `workos-events` — consuming audit log webhooks
