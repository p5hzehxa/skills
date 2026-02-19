<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### API Keys

Check environment variables:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

**Verify:** WorkOS SDK exists in project dependencies before writing code.

```bash
# Check SDK is installed (adjust grep pattern for your language)
grep -q "workos" package.json composer.json requirements.txt Gemfile pom.xml 2>/dev/null && echo "SDK found" || echo "FAIL: SDK not installed"
```

## Step 3: Event Type Architecture (Decision Tree)

WorkOS requires explicit event schema registration in Dashboard before emitting events.

```
Event schema decision tree:
  |
  +-- Arbitrary metadata (no validation)?
  |   → Create event in Dashboard WITHOUT "Require metadata schema validation"
  |   → metadata accepts any JSON structure
  |
  +-- Type-safe metadata (prevent malformed events)?
      → Create event WITH "Require metadata schema validation"
      → Define JSON Schema for root metadata, actor metadata, target metadata
      → SDK will reject events that don't match schema
```

**Event naming convention:** `{domain}.{resource}.{action}`

Examples:
- `user.signed_in`
- `document.deleted`
- `payment.processed`

**CRITICAL:** Event types cannot be renamed after creation. Plan naming carefully.

## Step 4: Metadata Schema Constraints (Trap Warning)

If using metadata schema validation:

**Hard limits per metadata object:**
- 50 keys maximum
- Key names: 40 characters max
- Values: 500 characters max

**Common trap:** Agents often try to put large JSON blobs in metadata. This fails validation. Instead:
- Store references (IDs, URLs) in metadata
- Store full data in your own database

**Schema locations:**
- Root event metadata
- Actor metadata (who performed the action)
- Target metadata (what was affected)

Each location has its own independent schema. Check fetched docs for Dashboard UI flow.

## Step 5: Emit Events (Implementation Pattern)

Use SDK method for creating audit log events. Check fetched docs for exact method signature in your language.

**Pattern (pseudocode):**
```
emit_audit_log_event({
  organization_id: "org_123",
  event: {
    action: "user.signed_in",
    occurred_at: ISO8601_timestamp,
    actor: {
      type: "user",
      id: "user_456",
      metadata: { /* optional, must match schema if validation enabled */ }
    },
    targets: [
      {
        type: "session",
        id: "session_789",
        metadata: { /* optional, must match schema if validation enabled */ }
      }
    ],
    context: {
      location: "192.168.1.1",
      user_agent: "Mozilla/5.0..."
    },
    metadata: { /* optional, must match schema if validation enabled */ }
  }
})
```

**Return immediately:** Audit log APIs return 200 immediately. Events are processed asynchronously. Do NOT wait for confirmation.

## Step 6: Log Streams Setup (Decision Tree)

```
Who configures the stream?
  |
  +-- You (as platform provider)
  |   → Configure in WorkOS Dashboard
  |   → Works across all organizations
  |
  +-- Customer's IT admin
      → Enable Admin Portal for organization
      → Customer configures their own SIEM destination
```

### SIEM Provider Selection

```
Customer's SIEM provider?
  |
  +-- Datadog → Events sent to HTTP Log Intake API (regional endpoints supported)
  |
  +-- Splunk → Events sent to HTTP Event Collector (HEC)
  |
  +-- AWS S3 → Events stored as individual JSON files
  |             Requires cross-account IAM role with external ID
  |             Uses ContentMD5 header for Object Lock compatibility
  |
  +-- Google Cloud Storage → Check fetched docs for setup
  |
  +-- Generic HTTP POST → Events POSTed to customer's endpoint
```

### IP Allowlist (CRITICAL)

If customer's SIEM restricts by IP, they MUST allowlist these addresses:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Common trap:** Customer configures stream, then wonders why no events arrive. Check their firewall first.

## Step 7: AWS S3 Stream Configuration (Trap Warning)

If streaming to S3:

**Authentication method:** Cross-account IAM role with external ID (NOT access keys)

**Critical for Object Lock buckets:** WorkOS uploads objects with `ContentMD5` header. This is required for Object Lock compliance mode.

**Common trap:** Customer creates bucket with default settings, uploads fail silently. If using Object Lock, bucket MUST support MD5 checksums.

Check fetched docs for exact IAM policy requirements and role ARN format.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check API keys exist
env | grep -q "WORKOS_API_KEY=sk_" && echo "API key valid" || echo "FAIL: API key missing or wrong prefix"

# 2. Check SDK installed
# (adjust for your package manager)
ls node_modules/@workos-inc 2>/dev/null || echo "FAIL: SDK not found"

# 3. Emit test event (replace with actual SDK method)
# Should return 200 immediately - does NOT guarantee delivery
# Check WorkOS Dashboard > Audit Logs to verify event appears

# 4. If using Log Streams: verify events arrive at destination
# Check SIEM provider's UI after 1-2 minutes (not instant)
```

## Error Recovery

### "Event type does not exist"

**Cause:** Event not registered in Dashboard before emitting.

**Fix:**
1. Log into WorkOS Dashboard
2. Navigate to Audit Logs > Event Catalog
3. Create event with action name matching your code
4. Re-run emission

### "Metadata validation failed"

**Cause:** Event metadata doesn't match registered JSON Schema.

**Diagnose:**
1. Check error response for which field failed
2. Compare against schema in Dashboard > Event Catalog > [Your Event] > Schema Editor

**Common issues:**
- Missing required field in schema
- Value exceeds 500 character limit
- Key name exceeds 40 character limit
- More than 50 keys in metadata object

### Events not appearing in SIEM after stream configured

**Decision tree:**

```
Check in order:
  |
  1. WorkOS Dashboard > Organization > Log Streams > Check status
     → If "Error" status: fix configuration issue shown
  |
  2. If AWS S3: Check IAM role trust policy includes WorkOS account
     → See fetched docs for exact account ID and external ID format
  |
  3. If Datadog/Splunk: Verify API key/token has write permissions
  |
  4. If generic HTTP: Check endpoint is publicly reachable
     → WorkOS cannot reach internal/VPN-only endpoints
  |
  5. Check customer's firewall allows WorkOS IPs (see Step 6)
```

**Timing note:** Log streams are NOT real-time. Expect 1-5 minute delay from emission to delivery.

### "Invalid organization_id"

**Cause:** Organization ID prefix wrong or org doesn't exist.

**Fix:**
- Organization IDs start with `org_`
- Verify org exists in WorkOS Dashboard
- Check you're using production vs staging org ID correctly

### Admin Portal not showing Log Streams option

**Cause:** Feature not enabled for organization.

**Fix:** Check WorkOS Dashboard > Organizations > [Org] > Admin Portal > Enable "Log Streams" module.

## Exporting Events (Batch Operations)

For bulk export or backup:

**Decision tree:**
```
Export destination?
  |
  +-- One-time CSV download → Use Dashboard > Audit Logs > Export
  |
  +-- Recurring automated export → Configure Log Stream to S3/GCS
  |
  +-- API-driven export → Use SDK list/search methods
      → Check fetched docs for pagination and filters
```

**Date range limits:** Check fetched docs for maximum retention period and export window size.

## Related Skills

- workos-authkit-nextjs (for user authentication context in audit events)
- workos-authkit-react (for capturing client-side user actions)
