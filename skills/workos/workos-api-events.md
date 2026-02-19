---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this skill when you need to retrieve audit logs or system events from WorkOS services. The Events API provides a unified log stream of authentication, directory sync, and administrative actions. Reach for this when building compliance dashboards, debugging user flows, or auditing organizational activity.

## Key Vocabulary

- **Event** (`event_`) — a single logged action with timestamp, actor, and target metadata
- **Event types** — namespaced strings like `authentication.email_verification_succeeded`, `dsync.user.created`, `connection.activated`
- **`after` parameter** — pagination cursor for retrieving events chronologically
- **`events` array** — top-level response field containing event objects
- **`list_metadata`** — pagination metadata with `after` cursor for next page
- **`occurred_at`** — ISO 8601 timestamp when the event occurred

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-events.guide.md`

## Related Skills

- workos-directory-sync
- workos-audit-logs
- workos-sso
