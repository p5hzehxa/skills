---
name: workos-audit-logs
description: Implement audit logging for compliance and security.
---

<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth for API behavior:

- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# WORKOS_API_KEY must start with sk_
echo $WORKOS_API_KEY | grep -q '^sk_' || echo "FAIL: Invalid API key format"
```

### SDK Installation

Verify SDK is installed before writing code:

```bash
# Check SDK exists (language-specific)
# Node.js example:
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: Event Schema Design (Decision Tree)

Before emitting events, decide event structure:

```
Event naming?
  |
  +-- Follow pattern: {domain}.{resource}.{action}
      Examples: user.signed_in, document.created, role.updated
      |
      +-- Need custom metadata validation?
          |
          +-- YES --> Create JSON Schema in Dashboard (Step 4)
          |
          +-- NO  --> Use arbitrary metadata (skip to Step 5)
```

**Metadata limits (hard constraints):**
- Max 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

Exceeding these limits → API rejection.

## Step 4: Configure Metadata Schema (Optional)

If using strict validation, configure in Dashboard BEFORE emitting events:

1. Navigate to Dashboard → Audit Logs → Events
2. Create/edit event type
3. Check "Require metadata schema validation"
4. Define JSON Schema for three metadata locations:
   - Root event metadata
   - Actor metadata
   - Targets metadata (each target can have different schema)

**Trap:** Events failing schema validation are REJECTED at emit time. Test schema with sample events before production.

**Verify schema is active:**

```bash
# Emit test event with invalid metadata - should fail
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d '{"action":"test.invalid","metadata":{"invalid_key":"exceeds_schema"}}' \
  | grep -q "schema_validation_error" && echo "PASS: Schema validation active"
```

## Step 5: Emit Events

Use SDK method for creating events (check fetched docs for exact signature in your language).

**Pattern for event emission:**

```
1. Construct event object with:
   - action (string): {domain}.{resource}.{action}
   - occurred_at (ISO8601 timestamp)
   - actor (object): {id, type, name?, metadata?}
   - targets (array): [{id, type, name?, metadata?}]
   - context (object): {location?, user_agent?}
   - metadata (object): custom data conforming to schema if enabled

2. Call SDK emit method
3. Return immediately (200 OK) - do NOT wait for downstream processing
4. Handle validation errors synchronously
```

**Critical:** Event emission is fire-and-forget. If downstream log streams fail, events are NOT retried automatically. Check fetched docs for retry semantics.

**Common validation errors:**

- `invalid_action_format` → Action doesn't match pattern
- `schema_validation_error` → Metadata violates JSON Schema
- `metadata_limit_exceeded` → >50 keys or value >500 chars
- `invalid_timestamp` → occurred_at not valid ISO8601

## Step 6: Configure Log Streams (Decision Tree)

```
Who configures log stream?
  |
  +-- Your ops team    --> Configure in WorkOS Dashboard
  |
  +-- Customer IT admin --> Enable in Admin Portal (requires Organization setup)
                           Check fetched docs for Admin Portal integration steps
```

### Dashboard Configuration Path

1. Dashboard → Audit Logs → Log Streams
2. Select provider type:

```
Provider?
  |
  +-- Datadog --> Requires: API key, region (US/EU)
  |               Endpoint: Datadog HTTP Log Intake API
  |
  +-- Splunk  --> Requires: HEC token, endpoint URL
  |               Format: JSON to HTTP Event Collector
  |
  +-- AWS S3  --> Requires: Bucket name, region, IAM role ARN, external ID
  |               Pattern: One JSON file per event
  |               Auth: Cross-account IAM role
  |
  +-- GCS     --> Requires: Bucket name, service account credentials
  |
  +-- HTTP    --> Requires: Endpoint URL, optional auth headers
                  Use for custom SIEM or webhook endpoints
```

### IP Allowlist (CRITICAL for restricted endpoints)

If streaming to IP-restricted host, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Failure mode:** If IPs not allowlisted, log stream appears configured but events silently drop. Check destination logs for connection refusals.

### AWS S3 Specific Requirements

- WorkOS uploads with `ContentMD5` header (required for Object Lock buckets)
- Cross-account IAM role must have `s3:PutObject` permission
- External ID must match Dashboard configuration

**IAM Policy Pattern:**

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "s3:PutObject",
    "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
  }]
}
```

**Trust relationship must include WorkOS account and external ID** — check fetched docs for exact ARN and external ID requirements.

## Step 7: Verify Log Stream Delivery

### Test Event Emission

Emit a test event and verify it reaches destination:

```bash
# 1. Emit test event via SDK or API
curl -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test.stream.verification",
    "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "actor": {"id": "user_test", "type": "user"},
    "targets": [{"id": "test", "type": "verification"}]
  }'

# 2. Check destination (provider-specific):

# Datadog: Search logs for action:"test.stream.verification"
# Splunk: Search index for "test.stream.verification"
# S3: List bucket for new .json file
aws s3 ls s3://YOUR_BUCKET/audit_logs/ --recursive | tail -1

# HTTP: Check endpoint logs for POST request
```

**Latency expectations:**
- Datadog/Splunk: ~30-60 seconds
- S3/GCS: ~2-5 minutes (batched uploads)
- HTTP: Near real-time

If events don't appear after 10 minutes → log stream misconfigured.

## Step 8: Admin Portal Integration (Optional)

If customers self-configure log streams, enable Admin Portal access:

1. Organization must be created (requires SSO or Directory Sync setup)
2. Navigate to Dashboard → Admin Portal → Settings
3. Enable "Audit Logs" feature
4. Customer IT admin accesses via `https://id.workos.com/admin-portal`

**Trap:** Admin Portal requires Organization context. If user sees "Feature not available", check Organization setup first.

Check fetched docs for Admin Portal authentication flow — varies by integration type.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. API key format valid
echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS: API key format" || echo "FAIL"

# 2. SDK installed
# Node.js example - adjust for your language:
npm list @workos-inc/node &>/dev/null && echo "PASS: SDK installed" || echo "FAIL"

# 3. Event emission succeeds (returns event ID)
curl -s -X POST https://api.workos.com/audit_logs/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"test.verification","occurred_at":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","actor":{"id":"test","type":"user"},"targets":[{"id":"test","type":"test"}]}' \
  | grep -q '"id":"audit_log_' && echo "PASS: Event emission" || echo "FAIL"

# 4. If using log streams, verify event delivery (see Step 7 for provider-specific checks)

# 5. If using metadata schema, verify validation active (see Step 4)
```

## Error Recovery

### "schema_validation_error" on event emission

**Root cause:** Event metadata doesn't match JSON Schema defined in Dashboard.

**Fix:**
1. Fetch schema from Dashboard → Audit Logs → Events → [Event Type] → Schema tab
2. Validate event payload against schema locally before emitting
3. Common mismatches:
   - Extra keys not in schema
   - Wrong value type (string vs number)
   - Missing required fields

### Events emitted but not appearing in log stream

**Root cause decision tree:**

```
Events missing in destination?
  |
  +-- Check WorkOS Dashboard → Log Streams → [Stream] → Status
      |
      +-- Status: "Error" --> Check error message:
      |   |
      |   +-- "Authentication failed" --> Regenerate API key/token in provider
      |   +-- "Connection refused" --> Check IP allowlist (Step 6)
      |   +-- "Invalid endpoint" --> Verify endpoint URL in Dashboard
      |
      +-- Status: "Active" but no events --> Wait 10 minutes (batching delay)
          Still missing? --> Check provider-side:
          |
          +-- Datadog: Verify API key has "logs_write" permission
          +-- Splunk: Verify HEC token is enabled
          +-- S3: Check IAM role trust relationship and external ID
          +-- HTTP: Check endpoint returns 2xx status
```

### "invalid_action_format" error

**Root cause:** Action string doesn't follow `{domain}.{resource}.{action}` pattern.

**Fix:** Action must have exactly 2 dots separating 3 segments:
- Valid: `user.signed_in`, `document.created`, `payment.refund.issued`
- Invalid: `signin`, `user_signed_in`, `user.signin` (missing segment)

### "metadata_limit_exceeded" error

**Root cause:** Metadata object has >50 keys, key name >40 chars, or value >500 chars.

**Fix:**
1. Count keys: `Object.keys(metadata).length` must be ≤50
2. Truncate long values: `value.substring(0, 500)`
3. For large payloads, store in your DB and reference by ID in metadata

### S3 log stream "Access Denied" errors

**Root cause:** IAM role lacks permissions or trust relationship misconfigured.

**Fix checklist:**
1. IAM role has `s3:PutObject` on bucket
2. Trust relationship includes WorkOS account (check fetched docs for exact ARN)
3. External ID in trust policy matches Dashboard configuration
4. Bucket policy doesn't deny WorkOS role

**Verify IAM role:**

```bash
# Check trust relationship includes external ID
aws iam get-role --role-name YOUR_ROLE_NAME \
  | grep -q "YOUR_EXTERNAL_ID" && echo "PASS" || echo "FAIL: External ID mismatch"
```

### Admin Portal not visible to customer

**Root cause:** Organization not configured or feature not enabled.

**Fix:**
1. Verify Organization exists: Dashboard → Organizations → [Org ID]
2. Enable feature: Dashboard → Admin Portal → Settings → Enable "Audit Logs"
3. Customer must authenticate via SSO connection (not magic link)

Check fetched docs for Organization setup requirements.

## Related Skills

- **workos-authkit-nextjs**: Use with AuthKit to automatically log authentication events
- **workos-authkit-react**: Client-side auth state for actor context in audit events
