---
name: workos-api-events
description: WorkOS Events/Webhooks API endpoints — list events, manage webhook endpoints.
---

<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this API to retrieve historical events from WorkOS. The Events API provides a paginated list of all events that have occurred in your WorkOS environment, filterable by event type, organization, and time range. Reach for this when you need to audit activity, debug webhook delivery issues, or build internal dashboards that display historical event data rather than real-time webhook processing.

## Key Concepts

**Event Structure**
- Events use the naming convention `{domain}.{resource}.{action}` (e.g., `dsync.user.created`, `authentication.email_verification_succeeded`)
- Each event has a unique ID with prefix `event_`
- Events contain `created_at` timestamp, `event` type string, and domain-specific `data` payload

**Pagination**
- Events are returned in reverse chronological order (newest first)
- Use `limit` (default 10, max 100) to control page size
- Use `after` cursor for pagination (value from previous response's last event ID)
- Use `before` cursor to paginate backwards

**Filtering**
- `events[]` parameter: filter by one or more event types
- `organization_id`: scope results to a specific organization
- `occurred_at[gte]` and `occurred_at[lt]`: filter by timestamp range (ISO 8601 format)

**Rate Limits**
- Check fetched docs for current rate limits and retry behavior

**Common Use Cases**
- Auditing: query events for a specific organization over a date range
- Debugging webhooks: verify event was generated even if webhook failed
- Analytics: aggregate event counts by type or organization
- Backfill: replay historical events into your system

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-events.guide.md`

## Related Skills

- workos-webhooks-events (for real-time event processing vs. historical queries)
