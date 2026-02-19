---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## When to Use

Use this skill when you need to consume WorkOS system events (user sign-ins, directory sync changes, audit log writes) via webhooks or the Events API. Events provides real-time notifications and historical event retrieval for all WorkOS products, enabling observability, data syncing, and workflow automation.

## Key Vocabulary

- Event types follow the pattern `{product}.{resource}.{action}` (e.g., `dsync.user.created`, `user.created`)
- Event object with `id`, `event`, `created_at`, `data` structure
- Webhook endpoint URL (configured in WorkOS Dashboard → Webhooks)
- `WORKOS_WEBHOOK_SECRET` environment variable for signature verification
- Events API endpoint: `/events` with cursor-based pagination
- `after` and `before` query parameters for time-range filtering
- `events` query parameter for filtering by event type
- Datadog integration via Events Streams in Dashboard
- Event retention: 30 days for most events, 90 days for audit logs

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
