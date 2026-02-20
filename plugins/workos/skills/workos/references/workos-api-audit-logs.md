<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use Audit Logs when you need to track security-relevant user actions in your application (e.g., login attempts, resource access, permission changes). This API provides programmatic access to event ingestion, schema management, data export, and retention policies. If you need to query or stream events in real-time, use this skill; if you only need dashboard access, the Events feature may suffice.

## Key Vocabulary

- **Event** — a logged action with actor, target, and context metadata
- **Schema** — defines action types and their display names (e.g., `user.login_succeeded`)
- **Export** — CSV download of filtered event data, identified by `export_` prefix
- **Retention Policy** — configures how long events are stored before automatic deletion

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-audit-logs.guide.md`
