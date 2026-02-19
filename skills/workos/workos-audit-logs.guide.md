<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for implementation details:
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Confirm SDK is installed for your language:

```bash
# Node.js
ls node_modules/@workos-inc 2>/dev/null

# Python
pip show workos 2>/dev/null

# Ruby
gem list | grep workos

# Go
go list -m github.com/workos/workos-go 2>/dev/null
```

**CRITICAL:** SDK must exist before writing integration code.

## Step 3: Event Type Naming Convention

Use this pattern for all event types: `{domain}.{resource}.{action}`

Examples:
- `user.signed_in`
- `document.uploaded`
- `role.permission_changed`

**Trap:** Do NOT use generic action names without domain context (`signed_in` alone is invalid).

Check fetched docs for complete event type requirements.

## Step 4: Metadata Schema Configuration (Decision Tree)

```
Need type safety for event metadata?
  |
  +-- Yes --> Define JSON Schema in Dashboard
  |           |
  |           +-- Root event metadata (up to 50 keys)
  |           +-- Actor metadata (up to 50 keys)
  |           +-- Target metadata (up to 50 keys)
  |
  +-- No  --> Skip schema definition (metadata accepts any JSON)
```

**Constraints (enforced at validation time):**
- 50 keys max per metadata object
- Key names: 40 characters max
- Values: 500 characters max

**Where to configure:** Dashboard → Event schema editor → Check "Require metadata schema validation"

**Trap:** If schema validation is enabled and event doesn't match schema, SDK method will return error. Handle validation errors explicitly.

## Step 5: Emit Audit Events

Use SDK method for creating events. The exact method varies by language — check fetched docs for signature.

**Pattern (pseudocode):**

```
emit_event(
  organization_id: "org_123",
  event: {
    action: "user.signed_in",
    occurred_at: ISO8601_timestamp,
    actor: {
      type: "user",
      id: "user_456",
      metadata: { ... }  // optional, must match schema if defined
    },
    targets: [
      {
        type: "session",
        id: "session_789",
        metadata: { ... }  // optional, must match schema if defined
      }
    ],
    metadata: { ... }  // optional, must match schema if defined
  }
)
```

**Verification command:**

```bash
# Check event appears in Dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/audit_logs/events?limit=1" | jq
```

**Expected:** Event with your `action` type appears in response.

## Step 6: Log Streams Configuration (Optional)

Log Streams route events to customer SIEM providers. Configuration happens in Dashboard OR via Admin Portal (customer self-service).

### Supported Providers

- **Datadog** - Uses HTTP Log Intake API with regional endpoints
- **Splunk** - Uses HTTP Event Collector (HEC)
- **AWS S3** - Stores as individual JSON files (requires cross-account IAM role)
- **Google Cloud Storage** - Stores as individual JSON files
- **HTTP POST** - Generic webhook to any endpoint

### IP Allowlist (CRITICAL)

If streaming to IP-restricted hosts, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Trap:** Forgetting IP allowlist causes silent stream failures. Check destination firewall rules.

### Configuration Location

```
Who configures stream?
  |
  +-- You (provider)        --> Dashboard → Organization → Log Streams
  |
  +-- Customer (self-serve) --> Admin Portal → Configure SIEM integration
```

Check fetched docs for provider-specific setup (IAM roles for S3, HEC tokens for Splunk, API keys for Datadog).

## Step 7: Event Payload Structure

**DO NOT hardcode payload schemas** — they vary by destination provider and SDK version.

Check fetched docs for:
- Datadog envelope format
- Splunk HEC format
- S3 file naming convention
- HTTP POST headers and body structure

**Pattern verification (works for any provider):**

```bash
# 1. Emit test event via SDK
# 2. Check destination for arrival (Datadog logs, S3 bucket, etc.)
# 3. Verify payload structure matches docs
```

## Step 8: Admin Portal Integration (Customer Self-Service)

If you want customers to configure their own log streams:

1. Enable Admin Portal for organization (check fetched docs for enablement)
2. Customer navigates to Admin Portal URL
3. Customer configures SIEM integration with their credentials

**Trap:** Admin Portal URLs are organization-specific. Do NOT hardcode a single URL for all customers.

Check fetched docs for Admin Portal URL generation.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Confirm API key is set
echo $WORKOS_API_KEY | grep "^sk_" || echo "FAIL: Invalid API key format"

# 2. Confirm SDK installed
# (Use language-specific command from Step 2)

# 3. Emit test event and verify it appears
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/audit_logs/events?limit=5" | \
  jq -e '.data | length > 0' || echo "FAIL: No events found"

# 4. If using Log Streams, verify destination received event
# (Check Datadog logs, S3 bucket, Splunk index, etc.)
```

**Do not mark complete until all checks pass.**

## Error Recovery

### "Invalid metadata schema" error

**Root cause:** Event metadata doesn't match JSON Schema defined in Dashboard.

Fix:
1. Dashboard → Event schema editor → View schema
2. Compare your metadata structure to schema requirements
3. Either fix metadata OR update schema to accept current structure
4. If schema has 50+ keys, remove unused keys (hard limit)

### Log Stream events not arriving at destination

**Decision tree for diagnosis:**

```
Events missing from destination?
  |
  +-- Check WorkOS Dashboard → Events → Verify events exist
  |   |
  |   +-- No events --> Fix event emission (Step 5)
  |   +-- Events exist --> Continue below
  |
  +-- Check destination firewall/IP allowlist
  |   --> Add WorkOS IPs from Step 6
  |
  +-- Check provider credentials (Splunk HEC token, Datadog API key, S3 IAM role)
  |   --> Regenerate and update in Dashboard
  |
  +-- Check provider-specific quotas/rate limits
      --> Review provider's audit logs for rejections
```

### "Unauthorized" error when emitting events

**Root cause:** API key lacks Audit Logs write permission OR belongs to different environment.

Fix:
1. Dashboard → API Keys → Verify key has "Audit Logs" scope enabled
2. Verify key is for correct environment (staging vs production)
3. Regenerate key if scope cannot be edited

### S3 upload fails with "Access Denied"

**Root cause:** IAM role trust policy or permissions incorrect.

Fix:
1. Verify IAM role trust policy allows WorkOS account ID (check fetched docs for WorkOS account ID)
2. Verify External ID matches value in Dashboard
3. Verify role has `s3:PutObject` permission on destination bucket
4. If bucket has Object Lock enabled, verify role has `s3:PutObjectRetention` permission

**Trap:** WorkOS sets `ContentMD5` header for Object Lock compatibility. Do NOT restrict this header in bucket policy.

### Event appears in Dashboard but not in exports

**Root cause:** Exports are async and may have delay.

Check fetched docs for export timing and format. Events typically available for export within minutes, but bulk exports may be batched.

## Related Skills

- workos-authkit-nextjs (for capturing authentication events)
- workos-authkit-react (for capturing authentication events)
