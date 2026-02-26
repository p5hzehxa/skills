<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use this skill to record compliance-ready audit trails of user actions in your application. The Audit Logs API lets you emit events, configure retention policies, export historical data, and define custom action schemas. This is NOT for reading WorkOS internal logs — it's for storing YOUR application's audit events.

## Key Vocabulary

- **Event** — a single audit record with actor, action, target, timestamp
- **Schema** — defines valid action types and metadata fields for your events
- **Export** — a time-bound CSV dump of audit events
- **Retention** — how long events are stored before automatic deletion (90 days to 10 years)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-audit-logs.guide.md`
