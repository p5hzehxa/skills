---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this skill when you need to retrieve historical event logs from WorkOS. This is a read-only API for fetching events that have already occurred in your WorkOS organization, typically for audit trails, debugging webhooks, or backfilling event data. For real-time event delivery, use webhooks instead.

## Documentation

- https://workos.com/docs/reference/events
- https://workos.com/docs/reference/events/list

## Key Vocabulary

- **Event** `event_` — immutable log record of a WorkOS state change
- `WORKOS_API_KEY` — authentication credential for API requests
- `created_at` — ISO 8601 timestamp filter parameter
- `limit` — pagination size parameter (max 100)
- `after`, `before` — cursor-based pagination tokens
- Event type patterns: `connection.activated`, `dsync.user.created`, `user.created`
- `organization_id` — filter events by organization
- `events` — array field in list response

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-events.guide.md`

## Related Skills

- workos-api-webhooks — for real-time event delivery setup
