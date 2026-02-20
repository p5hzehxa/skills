<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for source of truth:

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Verify WorkOS SDK package exists in your dependency manifest before importing.

## Step 3: Event Schema Design (Decision Tree)

Before emitting events, choose your validation approach:

```
Need type safety for event metadata?
  |
  +-- YES --> Define JSON Schema in Dashboard
  |           Check "Require metadata schema validation"
  |           Schema applies to: root metadata, actor.metadata, targets[].metadata
  |
  +-- NO  --> Emit events with arbitrary metadata
              No validation, maximum flexibility
```

**Key constraints (from docs):**

- Metadata objects: 50 keys max
- Key names: 40 characters max
- Values: 500 characters max

**Trap warning:** If you enable schema validation after emitting events, existing events with non-conforming metadata will cause new events to fail. Validate historical data first or use schema validation from day one.

## Step 4: Event Emission Pattern

Use SDK method for creating audit log events. Check fetched docs for exact signature.

**Required fields (verify in docs):**

- `organization_id` - scopes event to customer
- `action` - format: `{domain}.{resource}.{verb}` (e.g., `user.account.created`)
- `occurred_at` - ISO 8601 timestamp

**Common pattern:**

```
workos.auditLogs.createEvent({
  organization_id: org_id,
  action: "document.file.uploaded",
  actor: {
    id: user_id,
    name: user_name,
    type: "user"
  },
  targets: [{
    id: document_id,
    type: "document"
  }],
  occurred_at: timestamp
})
```

**Architectural decision:** Return 200 immediately after SDK call. Do NOT wait for delivery confirmation. Audit logs are asynchronous — WorkOS handles retry and delivery.

## Step 5: Log Streams Configuration (Decision Tree)

```
Who configures export destination?
  |
  +-- Your team       --> Configure in WorkOS Dashboard
  |                       Path: Audit Logs → Log Streams
  |
  +-- Customer IT     --> Enable Admin Portal
                          Customer configures their own SIEM
```

### Provider-Specific Setup

**Datadog:**

- Regional endpoint selection required (US, EU, etc.)
- Events sent to HTTP Log Intake API
- Check fetched docs for payload structure

**Splunk:**

- HTTP Event Collector (HEC) endpoint required
- HEC token required
- Check fetched docs for authentication details

**AWS S3:**

- Cross-account IAM role with external ID required
- Events stored as individual JSON files per event
- **Critical:** WorkOS uploads with `ContentMD5` header — ensure bucket policy allows this (required for Object Lock)

**Generic HTTP:**

- Any endpoint accepting POST requests
- Custom header support available
- Check fetched docs for retry behavior

### IP Allowlist (CRITICAL)

If destination restricts by IP, allowlist these WorkOS addresses:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Trap warning:** Forgetting IP allowlist is the #1 cause of silent log stream failures. Streams show "active" in Dashboard but events never arrive. Always verify IP access before marking integration complete.

## Step 6: Admin Portal Integration (Optional)

If enabling customer self-service:

1. Generate Admin Portal link via SDK (check fetched docs for method)
2. Pass `organization_id` to scope access
3. Customer sees Audit Logs section with Log Streams configuration

**Architectural note:** Admin Portal is per-organization. One customer cannot see another's configuration.

## Verification Checklist (ALL MUST PASS)

Run these commands/checks:

```bash
# 1. Verify environment variables exist
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Verify SDK package installed
ls node_modules/@workos-inc || pip show workos || gem list workos

# 3. Test event emission (replace with actual SDK test)
# Should return success, NOT throw error
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"organization_id":"org_test","action":"test.verify.connection","occurred_at":"2024-01-01T00:00:00Z"}'

# 4. If using Log Streams, verify connection in Dashboard
# Navigate to: Audit Logs → Log Streams → [Your Stream] → Check "Last Event" timestamp
```

**Manual check:** Go to WorkOS Dashboard → Audit Logs → Events. Verify test event appears within 60 seconds.

## Error Recovery

### "organization_id not found"

**Root cause:** Organization not created in WorkOS yet.

Fix:

1. Create organization via SDK or Dashboard first
2. Use returned `organization_id` in events
3. Check fetched docs for organization creation method

### Events emitted but not visible in Dashboard

**Most common causes:**

1. **Wrong environment:** Using production API key but checking staging Dashboard (or vice versa)
   - Fix: Match API key environment to Dashboard environment

2. **Clock skew:** `occurred_at` timestamp too far in past/future
   - Fix: Use current timestamp ± 5 minutes max

3. **Schema validation failure:** Metadata doesn't match required schema
   - Fix: Check Dashboard → Audit Logs → Event Actions → View schema
   - Disable validation temporarily to test

### Log Stream shows "active" but events not arriving

**Most common causes (in order):**

1. **IP allowlist:** Destination blocks WorkOS IPs (see Step 5)
   - Fix: Add all 6 WorkOS IPs to allowlist

2. **S3 bucket policy:** Missing `ContentMD5` permission
   - Fix: Add `s3:PutObjectVersioning` if using Object Lock

3. **Datadog region mismatch:** Configured US endpoint but account is EU
   - Fix: Check Datadog account region, update Log Stream endpoint

4. **Splunk HEC token:** Invalid or expired token
   - Fix: Regenerate HEC token in Splunk, update WorkOS configuration

**Trap warning:** Log Stream failures are silent. WorkOS retries for 24 hours then drops events. Set up a test event schedule to catch delivery issues early.

### Metadata validation errors after enabling schema

**Root cause:** Historical events had different metadata structure.

Fix options:

1. Edit schema to accommodate both old and new formats
2. Disable validation, fix historical data, re-enable
3. Use schema validation only for new event types

Check fetched docs for editing event schemas after creation.

### "Rate limit exceeded"

Check fetched docs for rate limits and retry behavior. Use exponential backoff if batching event emissions.

## Related Skills

For integrating Audit Logs with authentication flows:

- workos-authkit-nextjs
- workos-authkit-react
