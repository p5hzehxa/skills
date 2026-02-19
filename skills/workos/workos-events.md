---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## When to Use

Use this skill when you need to react to changes in your WorkOS resources in real-time. Events enable building responsive systems that automatically trigger workflows when users sign in, directories sync, connections are activated, or SSO sessions are established. Choose this over polling when you need low-latency notifications of state changes across authentication, user management, and directory sync domains.

## Documentation

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api

## Key Concepts

**Event Type Naming Convention**: Events follow `{domain}.{resource}.{action}` pattern:
- `dsync.user.created`, `dsync.user.updated`, `dsync.user.deleted`
- `connection.activated`, `connection.deactivated`
- `authentication.email_verification_succeeded`
- `session.created` (legacy SSO events)

**Event ID Prefix**: All events use `event_` prefix (e.g., `event_01HZCZA86VYYGE0YEN8NQDCMS5`)

**Consumption Methods**:
- **Webhooks** (push): WorkOS sends events to your endpoint — return `200` immediately, verify signature before processing
- **Events API** (pull): Poll `/events` endpoint with `after` cursor for pagination — use when webhooks aren't viable (firewall restrictions, development environments)

**Webhook Signature Verification**: Every webhook includes `WorkOS-Signature` header with timestamp (`t=`) and signature (`v1=`) components — verify HMAC-SHA256 against `WORKOS_WEBHOOK_SECRET` to prevent spoofing

**Event Object Structure**:
- `id`: Event identifier (`event_` prefix)
- `event`: Event type string (domain.resource.action)
- `data`: Resource state snapshot at event time
- `created_at`: ISO 8601 timestamp

**Event Retention**: Events are retained for 30 days — design systems to handle replay within this window

**Architectural Pattern — Idempotency**: Events may be delivered multiple times — use `event.id` as idempotency key to prevent duplicate processing

**Dashboard Configuration**: Navigate to API Keys section to configure webhook endpoints and view event logs

**Datadog Integration**: Forward events to Datadog via native integration — configure in Dashboard under Observability settings

**Trap Warning**: Do NOT process webhook payload without signature verification — unsigned payloads may be forged

**Verification Commands**:
```bash
# Test webhook endpoint reachability
curl -X POST https://your-domain.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'

# Verify WORKOS_WEBHOOK_SECRET is set
echo $WORKOS_WEBHOOK_SECRET
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
