---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to emit compliance-grade audit events from your application, export them for customer review, or stream them to external security tools. Audit Logs records "who did what, when" for security and compliance requirements.

## Documentation

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events

## Key Vocabulary

- **Event** — a single audit record with actor, action, target, and metadata
- **Actor** — the entity performing the action (user, API key, system)
- **Action** — the verb describing what happened (e.g., `user.created`, `file.downloaded`)
- **Target** — the resource being acted upon
- **Metadata** — structured context for the event (JSON object)
- **Log Stream** — continuous export to external systems (Datadog, Splunk, S3)
- **Export** — on-demand CSV download of audit events
- `WORKOS_API_KEY` — server-side authentication for emitting events
- Organization `org_` — scopes audit events to a customer tenant

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
