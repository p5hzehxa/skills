<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## When to Use

Use this skill when you need to export structured compliance logs (actor, action, target, metadata) from your application to third-party SIEM tools. Audit Logs is a **data export product**, not an authentication or access control feature — it lets customers pull their organization's activity history via CSV exports or a streaming API.

## Key Vocabulary

- **Event** `event_` — a single audit log record (actor, action, target, occurred_at, metadata)
- **Export** `audit_log_export_` — a CSV snapshot of events filtered by date range and actor
- **Organization** `org_` — the tenant whose events are being logged/exported

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-audit-logs.guide.md`

## Related Skills

- **workos-events**: Webhook event handling
