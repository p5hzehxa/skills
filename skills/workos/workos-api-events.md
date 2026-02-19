---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this skill when you need to retrieve historical event data from WorkOS, such as audit logs, user activity, or system events. This is a read-only API for querying event records—use webhooks (separate skill) for real-time event notifications.

## Documentation

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Key Vocabulary

- **Event** `event_` — a recorded action or state change in WorkOS
- `after` — cursor parameter for pagination
- `before` — cursor parameter for pagination
- `limit` — maximum number of events to return per request
- `events` — filter parameter to specify event types
- `occurred_at` — timestamp when the event occurred
- `organization_id` — filter events by organization

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-events.guide.md`

## Related Skills

None
