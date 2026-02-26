<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this skill when you need to retrieve historical events from WorkOS services (SSO, Directory Sync, MFA, etc.). Events provide an audit log of actions and state changes across your WorkOS integration. If you need real-time event delivery, use webhooks instead.

## Key Vocabulary

- **Event `event_`** — a record of an action or state change in a WorkOS service
- **Event type** — categorizes events by domain and action (e.g., `authentication.email_verification_succeeded`, `dsync.user.created`)
- **Occurred at** — the timestamp when the event occurred in ISO 8601 format

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-events.guide.md`
