---
name: workos-api-audit-logs
description: WorkOS Audit Logs API endpoints — create events, manage schemas, exports, and retention.
---

<!-- refined:sha256:0064ec42049e -->

# WorkOS Audit Logs API Reference

## When to Use

Use this API when you need to emit tamper-proof audit events for compliance (SOC 2, HIPAA, GDPR) or surface a searchable audit trail in your product. Audit Logs provides structured event ingestion, schema validation, configurable retention, and CSV export — without building your own event storage infrastructure.

Reach for this when you need to answer "who did what, when" for security reviews, customer support, or regulatory audits.

## Key Concepts

**Event Structure**
- Event type naming: `{group}.{action}` (e.g., `user.created`, `document.deleted`)
- Actor: who performed the action (user, API key, or system)
- Target: what was affected (resource ID + type)
- Context: IP address, user agent, location metadata
- Occurred at: ISO 8601 timestamp (defaults to ingestion time if omitted)

**Schema Management**
- Schemas define valid actions for a group (e.g., `user` group with `created`, `updated`, `deleted` actions)
- Create schemas before emitting events — events failing schema validation are rejected
- List all schemas to see available event types
- List actions per group to validate event type strings before emission

**Export & Retention**
- Exports: async CSV generation for date ranges (poll export status, then download signed URL)
- Retention: configure per-organization how long events are stored (default varies, check dashboard)
- Set retention via API or dashboard — impacts export availability and compliance posture

**ID Prefixes & Auth**
- Organization ID: `org_` prefix (scope exports and retention to an org)
- Export ID: `audit_log_export_` prefix (use to poll export status)
- Auth: `WORKOS_API_KEY` (server-side only — never expose in client code)

**Dashboard Navigation**
- View events: Dashboard → Audit Logs → Events
- Manage schemas: Dashboard → Audit Logs → Schemas
- Configure retention: Dashboard → Audit Logs → Settings

**Architectural Decisions**
- Emit events asynchronously: return 200 immediately, don't block user flows on audit ingestion
- Use idempotency keys if retrying failed event creation (prevents duplicate events)
- Batch event creation if emitting high volumes (check fetched docs for batch endpoint availability)
- For compliance: verify retention meets your regulatory requirements before go-live

**Verification Commands**
```bash
# Confirm event was created (replace IDs and timestamps)
curl -X GET "https://api.workos.com/audit-logs?organization_id=org_123&occurred_at_gte=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Check schema exists before emitting events
curl -X GET "https://api.workos.com/audit-logs/schema/list?organization_id=org_123" \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"
```

**Common Traps**
- Emitting events before creating schemas → 400 validation error
- Using client-side API keys → security risk (audit logs are server-side only)
- Blocking user flows on event creation → degrades UX (emit async instead)
- Not setting retention → events may expire before you need them for audits

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-audit-logs.guide.md`
