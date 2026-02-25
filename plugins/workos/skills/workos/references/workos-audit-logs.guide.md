<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch all URLs below. These are the source of truth. If this skill conflicts with fetched docs, follow docs.

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - (optional for most audit log operations)

Verify: `echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing"`

### SDK Presence

Detect which SDK is installed (Node.js, Python, Ruby, Go, etc.) before writing integration code.

## Step 3: Event Structure Decision Tree

```
What are you logging?
  |
  +-- User action on a resource
  |     → event type: {group}.{object}.{action}
  |     → actor: user details
  |     → targets: [affected resource(s)]
  |     → occurred_at: ISO 8601 timestamp
  |
  +-- System event (no user)
  |     → actor.type = "system"
  |     → actor.id = service identifier
  |
  +-- Multi-resource operation
        → targets: array with multiple items
        → use consistent target.type across array
```

**Critical:** Event type naming MUST follow `{group}.{object}.{action}` convention (e.g., `user.account.created`, `document.share_link.accessed`).

## Step 4: Implementation Pattern

### Basic Event Emission

Use SDK method for creating events. Pattern:

```
workos.audit_logs.create_event({
  organization_id: "org_123",
  event: {
    action: "user.created",
    occurred_at: "2024-01-15T10:30:00Z",
    actor: {
      type: "user",
      id: "user_456",
      name: "Jane Admin"
    },
    targets: [{
      type: "user",
      id: "user_789",
      name: "New User"
    }]
  }
})
```

Check fetched docs for exact SDK method signature in your language.

### Metadata Schema (Advanced)

If you need structured validation on event metadata:

1. Navigate to WorkOS Dashboard → Audit Logs → Event Schemas
2. Enable "Require metadata schema validation" checkbox
3. Define JSON Schema for:
   - Root-level metadata
   - Actor metadata
   - Target metadata (within each target object)

**Limits:** 50 keys max per metadata object, 40 chars per key name, 500 chars per value.

**When to use:** Customer requires strict event structure for compliance, or you're migrating from a system with typed event schemas.

## Step 5: Log Streaming Setup (Customer-Facing)

Log Streams send events to customer SIEMs (Datadog, Splunk, S3, etc.).

### Configuration Path Decision

```
Who configures the stream?
  |
  +-- Your team (internal)
  |     → WorkOS Dashboard → Audit Logs → Log Streams → Create
  |     → Select provider, enter credentials
  |
  +-- Customer IT admin (self-service)
        → Enable Admin Portal for organization
        → Customer navigates to Admin Portal → Log Streams
        → Customer configures their own SIEM
```

### IP Allowlist (Critical for HTTP POST streams)

If customer's SIEM restricts by IP, allowlist these WorkOS egress IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Trap:** These IPs are for US region. Check fetched docs if using EU region.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check API key format
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ invalid format"

# 2. Verify SDK import exists in codebase
grep -r "workos" src/ app/ lib/ --include="*.js" --include="*.ts" --include="*.py" --include="*.rb" || echo "FAIL: SDK not imported"

# 3. Verify event emission exists
grep -r "audit_logs\|auditLogs\|create_event\|createEvent" src/ app/ lib/ || echo "FAIL: No audit log implementation found"

# 4. Check event type follows convention (manual review)
echo "Manually verify: event types match {group}.{object}.{action}"
```

## Error Recovery

### "Invalid event type format"

**Cause:** Event type doesn't follow `{group}.{object}.{action}` naming.

Fix:

1. Audit event types in code
2. Rename to three-part format: `document.share.created` NOT `shareCreated`
3. Check fetched docs for reserved action names

### "Metadata validation failed"

**Cause:** Metadata doesn't match JSON Schema (if schema validation enabled).

Fix:

1. Log the failed event payload to see actual vs. expected structure
2. Check WorkOS Dashboard → Event Schema editor for required fields
3. Disable schema validation temporarily if blocking deployment

### "Organization not found"

**Cause:** `organization_id` doesn't exist or wrong format.

Fix:

1. Verify organization ID starts with `org_`
2. Check organization exists: use SDK method to list organizations
3. If using Admin Portal: verify customer completed setup

### Log Stream not receiving events

**Cause:** IP blocked, credentials invalid, or stream not active.

Fix (in order):

1. Check customer SIEM allowlisted WorkOS IPs (see Step 5)
2. Verify stream status in Dashboard: must show "Active"
3. Test with generic HTTP POST stream to isolate SIEM-specific issues
4. Check fetched docs for provider-specific configuration requirements
