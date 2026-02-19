---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to record and export compliance-grade activity logs for your application. Audit Logs is a managed service that captures user actions (who did what, when, and where) and makes them available for security investigations, compliance reporting, or streaming to external SIEM tools.

## Key Vocabulary

- **Event** — a single audit trail entry with actor, action, target, timestamp, and metadata
- **Log Stream** — continuous export of audit events to external destinations (Datadog, Splunk, etc.)
- **Actor** — the entity performing the action (user, API key, service account)
- **Target** — the resource being acted upon (file, database, setting)
- **Action** — the verb describing what happened (e.g., `user.login`, `file.delete`)
- **Metadata Schema** — structured key-value pairs attached to events for filtering/searching
- **Export** — manual CSV download of historical audit events
- **Organization `org_`** — the tenant whose events you're logging

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
