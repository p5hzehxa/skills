<!-- refined:sha256:96424db5567d -->

# WorkOS Events

## When to Use

Use this skill when you need to subscribe to real-time notifications about changes in WorkOS resources (users, organizations, directory sync events, etc.). Events provide a webhook-based alternative to polling APIs, allowing your application to react immediately when WorkOS state changes.

## Key Vocabulary

- **Event** `event_` — a notification payload describing a state change
- **Event type** — the action that occurred (e.g., `dsync.user.created`, `organization.updated`)
- **Webhook endpoint** — your application's HTTPS URL that receives event POST requests
- **Event payload** — the JSON body containing the event object and associated data
- **Delivery attempt** — a single POST request to your webhook endpoint (WorkOS retries on failure)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
