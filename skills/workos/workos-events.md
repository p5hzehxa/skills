---
name: workos-events
description: Subscribe to and handle WorkOS webhook events.
---

<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## When to Use

Use this skill when you need to consume real-time notifications about WorkOS resource changes (SSO authentications, Directory Sync updates, user provisioning events, etc.) via webhooks or polling. Events provide a push-based alternative to periodic API polling for keeping your application state synchronized with WorkOS.

## Documentation

- https://workos.com/docs/events/index
- https://workos.com/docs/events/observability/datadog
- https://workos.com/docs/events/data-syncing/webhooks
- https://workos.com/docs/events/data-syncing/index
- https://workos.com/docs/events/data-syncing/events-api

## Key Vocabulary

- **Event** `event_` — A WorkOS resource change notification with type, timestamp, and payload
- **Event type patterns** — Dot-notation format like `dsync.user.created`, `connection.activated`, `session.created`
- **Webhook endpoint** — HTTPS URL in your application that receives POST requests from WorkOS
- **Webhook signature** — `WorkOS-Signature` header value for verifying event authenticity
- **`WORKOS_WEBHOOK_SECRET`** — Environment variable containing the signing secret for webhook verification
- **Events API** — REST endpoint for polling events (alternative to webhooks)
- **Event delivery** — At-least-once guarantee; application must handle duplicates

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
