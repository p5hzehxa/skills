<!-- refined:sha256:106ca62de786 -->

# WorkOS Events

## When to Use

Use this skill when you need to receive real-time notifications about changes to WorkOS resources in your application. Events let you build integrations that react to user provisioning changes, authentication events, organization updates, and other WorkOS resource lifecycle changes without polling.

## Key Vocabulary

- **Event** `event_` — a notification payload representing a change to a WorkOS resource
- **Webhook endpoint** — your application's HTTPS URL that receives event POST requests
- **Event types** — dot-separated strings like `dsync.user.created`, `connection.activated`, `organization.updated`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-events.guide.md`

## Related Skills

- **workos-audit-logs**: Audit log integration
