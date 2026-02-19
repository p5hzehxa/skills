---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to emit security-sensitive audit events from your application (user logins, permission changes, data access) and provide customers with a standardized audit trail for compliance. Audit Logs solves the problem of building tamper-proof event storage, customer-facing UIs, and export integrations—it's the compliance layer for B2B SaaS.

## Documentation

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events

## Key Concepts

### Event Structure
- **Event naming convention**: `{group}.{action}` (e.g., `user.login`, `file.downloaded`)
- **Actor**: The entity performing the action (user, API key, system)—includes `id`, `name`, `type`
- **Target**: The resource being acted upon—includes `id`, `name`, `type`
- **Context**: Additional metadata (IP address, user agent, location)—optional but recommended for compliance

### Organization Scoping
- Events are always scoped to an **organization ID** (`org_` prefix)
- Use the organization ID from your authenticated user's session
- Each customer sees only their own organization's events

### Metadata Schema
- Define your event catalog in the WorkOS Dashboard under Audit Logs > Events
- Schema includes: event name, display name, description, actor/target types
- Schema enforcement: WorkOS validates events against your schema at ingestion time

### Log Streams
- **Log Streams** enable customers to export their audit logs to external systems (S3, Datadog, etc.)
- Customers configure streams in the WorkOS-provided Audit Logs UI
- Your application doesn't implement export logic—WorkOS handles delivery

### Event Immutability
- Events are immutable by default—cannot be deleted
- Use `events.update()` to append correction metadata (e.g., redacting PII)
- Original event remains in the log with a link to the correction

### Dashboard Integration
- WorkOS provides a hosted Audit Logs UI at a subdomain you configure
- Embed the UI in your app via iframe or link to it directly
- Customers can search, filter, and export their events without you building a UI

### Decision Tree: When to Emit Events
- **Emit synchronously** for critical security events (login, password change)—wait for WorkOS confirmation
- **Emit asynchronously** for high-volume events (API calls, file access)—queue and batch
- **Skip emitting** for read-only operations unless compliance requires it

### Traps
- **Don't emit PII in event metadata** unless you have a retention/redaction policy—use hashed IDs instead
- **Don't reuse actor IDs across organizations**—scope actor IDs to the org (e.g., `org_123:user_456`)
- **Don't emit events for system actions** without an actor—use a system actor with `type: system`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
