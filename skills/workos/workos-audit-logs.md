---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to emit compliance-grade audit events from your application, export user activity logs to external systems, or provide customers with self-service access to their organization's audit trail. Choose Audit Logs when you need structured, tamper-evident activity records — not generic application logging.

## Documentation

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events

## Key Vocabulary

- **Event** — a single audit record with actor, action, target, and context metadata
- **Log Stream** — export destination for audit events (e.g., S3, Datadog)
- **Organization `org_`** — tenant context for multi-tenant audit trails
- **Actor** — the entity performing the action (user, API key, system)
- **Target** — the resource being acted upon (file, user, project)
- **Action** — the verb describing what happened (e.g., `user.created`, `file.deleted`)
- **Context** — additional metadata (IP address, user agent, location)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
