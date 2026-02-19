<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. https://workos.com/docs/audit-logs/index
2. https://workos.com/docs/audit-logs/metadata-schema
3. https://workos.com/docs/audit-logs/log-streams
4. https://workos.com/docs/audit-logs/exporting-events
5. https://workos.com/docs/audit-logs/editing-events
6. https://workos.com/docs/audit-logs/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Requirements

- Confirm WorkOS SDK is installed (check `package.json` or equivalent)
- Confirm Dashboard access: https://dashboard.workos.com/

## Step 3: Event Schema Design (Decision Tree)

Before emitting events, decide on event naming convention:

```
Do you need custom metadata validation?
  |
  +-- YES --> Use metadata schema (Step 4)
  |           |
  |           +-- Strict validation required?
  |           |     |
  |           |     +-- YES --> Enable "Require metadata schema validation" in Dashboard
  |           |     |
  |           |     +-- NO  --> Define schema but allow schema-less events
  |           |
  |           +-- Continue to Step 5
  |
  +-- NO  --> Skip to Step 5 (events can have arbitrary metadata)
```

**Event naming pattern:** `{domain}.{resource}.{action}`

Examples:
- `user.signed_in`
- `document.updated`
- `payment.processed`

**Trap:** Event type names are case-sensitive. Decide on a convention (snake_case recommended) and document it.

## Step 4: Metadata Schema Configuration (OPTIONAL)

If using metadata schemas (from decision tree above):

### Schema Location Decision

Events have THREE metadata locations. Decide which need schemas:

```
Where is custom metadata?
  |
  +-- Root event metadata   --> Define schema for root object
  |
  +-- Actor metadata        --> Define schema for actor.metadata
  |
  +-- Target metadata       --> Define schema for targets[].metadata
```

### Dashboard Configuration

Navigate: Dashboard → Audit Logs → Event Types → [Your Event] → Schema Editor

**Limits (CRITICAL):**
- Max 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

**Schema validation pattern:**

```
1. Click event type in Dashboard
2. Check "Require metadata schema validation" (if strict validation needed)
3. Click "+" to add properties to metadata objects
4. Save schema
```

**Validation behavior:**
- Events not matching schema → API returns error
- Check fetched docs for exact error response format

### Testing Schema Validation

After defining schema, test with both valid and invalid events:

```bash
# Test valid event (should succeed)
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ... valid metadata ... }'

# Test invalid event (should fail with schema error)
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ... invalid metadata ... }'
```

**Expected:** Invalid event returns 4xx error referencing schema violation.

## Step 5: Event Emission Pattern

Use SDK method for creating events. Check fetched docs for exact method signature.

**Pseudocode pattern:**

```
Create event with:
  - organization_id (required)
  - action (event type string, required)
  - occurred_at (ISO 8601 timestamp)
  - actor object (type, id, name, metadata)
  - targets array (type, id, name, metadata)
  - context object (location, user_agent)
  - metadata object (root-level custom data)

Return immediately with 200
Do NOT wait for downstream processing
```

**Trap:** `occurred_at` must be ISO 8601 format. Do not use Unix timestamps.

**Trap:** If event has metadata schema enabled, emit will fail if metadata doesn't match. Validate before calling SDK.

## Step 6: Log Streams Setup (Decision Tree)

```
Who configures log streams?
  |
  +-- Your team (central config)
  |     |
  |     +-- Navigate: Dashboard → Audit Logs → Log Streams → Create Stream
  |     +-- Select provider (Step 7)
  |
  +-- Customer's IT admin (self-service)
        |
        +-- Enable Admin Portal access for organization
        +-- Customer configures via: dashboard.workos.com/admin-portal
        +-- Skip to Step 8
```

## Step 7: Provider Configuration (ONLY if configuring log streams)

WorkOS supports these providers. Configuration differs per provider:

```
Provider type?
  |
  +-- Datadog
  |     |
  |     +-- Regional endpoint selection required
  |     +-- API key from Datadog (not WorkOS key)
  |     +-- Events sent to HTTP Log Intake API
  |     +-- Check fetched docs for exact payload format
  |
  +-- Splunk
  |     |
  |     +-- HTTP Event Collector (HEC) endpoint required
  |     +-- HEC token from Splunk required
  |     +-- Events sent to /services/collector endpoint
  |     +-- Check fetched docs for exact payload format
  |
  +-- AWS S3
  |     |
  |     +-- Bucket name required
  |     +-- Region required
  |     +-- Cross-account IAM role with external ID required
  |     +-- Role must allow s3:PutObject with ContentMD5 header
  |     +-- Object Lock buckets supported (ContentMD5 required)
  |     +-- Events stored as individual JSON files
  |     +-- Check fetched docs for IAM policy requirements
  |
  +-- Google Cloud Storage
  |     |
  |     +-- Bucket name required
  |     +-- Service account credentials required
  |     +-- Check fetched docs for exact permissions
  |
  +-- HTTP POST (generic)
        |
        +-- Destination URL required
        +-- Optional: custom headers
        +-- Events posted as JSON to specified endpoint
```

### IP Allowlist (CRITICAL for HTTP POST and restricted endpoints)

If streaming to a host with IP restrictions, allowlist these WorkOS IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

**Do NOT forget this step** — streams will fail silently without proper allowlisting.

## Step 8: Exporting Historical Events (OPTIONAL)

If you need to export existing events:

Navigate: Dashboard → Audit Logs → Exports → Create Export

**Export format decision:**

```
Export format?
  |
  +-- CSV  --> For spreadsheet analysis
  |
  +-- JSON --> For programmatic processing
```

**Filters available:**
- Date range
- Event types
- Actor IDs
- Organization IDs

Check fetched docs for export limits and delivery mechanism.

## Step 9: Admin Portal Integration (OPTIONAL)

If customers need self-service access to their audit logs:

### Enable Admin Portal

Pseudocode pattern:

```
Generate Admin Portal link using SDK:
  - organization_id (required)
  - intent = "audit_logs" (required)
  - return_url (where customer returns after)

Direct customer to generated URL
Customer can:
  - View their audit log events
  - Configure log streams (if enabled)
  - Export their events
```

Check fetched docs for exact SDK method signature and available intents.

**Trap:** Admin Portal links expire. Generate fresh links for each session — do not cache them.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup:

```bash
# 1. Verify SDK is installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not found"

# 2. Verify environment variables
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: Missing env vars"

# 3. Test event emission (replace with real org ID)
curl -X POST https://api.workos.com/events \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "org_01H1234567890ABCDEFGHIJK",
    "action": "test.verification.success",
    "occurred_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }' && echo "PASS: Event created" || echo "FAIL: Event creation failed"

# 4. Verify Dashboard access
curl -I https://dashboard.workos.com/ 2>/dev/null | grep -q "200" && echo "PASS: Dashboard reachable"

# 5. If using log streams, verify IP allowlist (manual check)
echo "MANUAL: Confirm WorkOS IPs allowlisted if using restricted endpoints"
```

**If check #3 fails:**
- Verify API key is valid (`sk_` prefix)
- Verify organization ID exists in Dashboard
- Check fetched docs for current event creation endpoint

## Error Recovery

### "Organization not found" error when emitting events

**Root cause:** Invalid `organization_id` or organization doesn't exist in your WorkOS account.

**Fix:**
1. List organizations via Dashboard or SDK
2. Confirm organization ID format: `org_` prefix
3. Use valid organization ID in event payload

### "Schema validation failed" error

**Root cause:** Event metadata doesn't match defined JSON Schema.

**Fix:**
1. Check Dashboard → Event Types → [Your Event] → Schema
2. Compare event payload metadata with schema requirements
3. Either fix payload or update schema
4. If schema is too strict, disable "Require metadata schema validation"

### "Invalid occurred_at format" error

**Root cause:** Timestamp not in ISO 8601 format.

**Fix:** Use ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

Example: `2024-01-15T14:30:00Z`

Do NOT use Unix timestamps or non-UTC timezones without offset.

### Log stream not receiving events

**Root cause:** One of several issues.

**Decision tree:**

```
Events not appearing in SIEM?
  |
  +-- Check WorkOS Dashboard → Log Streams → [Your Stream] → Status
  |     |
  |     +-- Status = "error" --> Check error message, fix provider config
  |     |
  |     +-- Status = "active" --> Continue diagnostic
  |
  +-- For HTTP POST / restricted endpoints:
  |     |
  |     +-- Verify WorkOS IPs are allowlisted (see Step 7)
  |     +-- Check destination endpoint logs for connection attempts
  |
  +-- For AWS S3:
  |     |
  |     +-- Verify IAM role trust policy includes WorkOS external ID
  |     +-- Verify IAM role has s3:PutObject permission
  |     +-- Check S3 bucket policies don't block WorkOS
  |
  +-- For Datadog/Splunk:
        |
        +-- Verify API key / HEC token is valid
        +-- Check provider's ingestion logs for errors
```

### "Metadata exceeds limit" error

**Root cause:** Violated metadata object limits (50 keys, 40 char keys, 500 char values).

**Fix:**
1. Count metadata keys (must be ≤ 50)
2. Check key name lengths (must be ≤ 40 chars)
3. Check value lengths (must be ≤ 500 chars)
4. If legitimate need for more data, consider splitting into multiple events or using targets array

### Admin Portal link expired

**Root cause:** Links have TTL and expire after use or timeout.

**Fix:** Generate fresh link for each customer session. Do not store or reuse links.

## Related Skills

- workos-authkit-nextjs - For user authentication before emitting audit events
- workos-authkit-react - For client-side authentication context
