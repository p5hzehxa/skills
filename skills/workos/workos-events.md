---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## When to Use

Use this skill when you need to consume WorkOS events via webhooks or the Events API. Events notify your application of changes across WorkOS resources (users, organizations, connections, etc.) in real-time or via polling. Choose webhooks for push-based notification and the Events API for pull-based polling or event replay.

## Documentation

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api

## Key Vocabulary

- **Event** `event_` — a notification of a state change in a WorkOS resource
- Event types follow pattern `{resource}.{action}` (e.g., `dsync.user.created`, `connection.activated`)
- **Webhook Endpoint** — the URL WorkOS POSTs events to
- **Events API** — pull-based endpoint for fetching events by filters or pagination
- **Webhook Secret** — used to verify webhook signature in `WorkOS-Signature` header
- **After cursor** — pagination token for fetching events chronologically

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
