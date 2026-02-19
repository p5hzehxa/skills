<!-- refined:sha256:ac9f8f303b5d -->

# WorkOS Audit Logs

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/audit-logs/metadata-schema
- https://workos.com/docs/audit-logs/log-streams
- https://workos.com/docs/audit-logs/index
- https://workos.com/docs/audit-logs/exporting-events
- https://workos.com/docs/audit-logs/editing-events
- https://workos.com/docs/audit-logs/admin-portal

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required environment variables:

```bash
# Must exist and start with correct prefix
grep -E "WORKOS_API_KEY=sk_" .env* || echo "FAIL: API key missing or wrong prefix"
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: Client ID missing"
```

### SDK Installation

Verify SDK is installed before writing code:

```bash
# Check SDK exists in dependencies
cat package.json | grep -E "(workos|@workos)" || echo "FAIL: WorkOS SDK not in package.json"
```

## Step 3: Event Naming Convention

Structure event types as: `{domain}.{resource}.{action}`

**Examples:**
- `user.signed_in`
- `document.shared`
- `payment.processed`

**Decision tree for domain selection:**

```
Event relates to...
  |
  +-- User account operations --> domain: "user"
  |
  +-- Document/file operations --> domain: "document"
  |
  +-- Financial transactions --> domain: "payment"
  |
  +-- Admin actions --> domain: "admin"
  |
  +-- API/integration events --> domain: "api"
```

Use lowercase, dot-separated format. Check fetched docs for complete naming conventions.

## Step 4: Metadata Schema Setup (OPTIONAL)

### When to Use Metadata Schemas

**Decision tree:**

```
Need type validation for event metadata?
  |
  +-- YES, need strict validation --> Configure JSON Schema (Step 4a)
  |
  +-- NO, any shape OK --> Skip to Step 5
```

### 4a: Configure JSON Schema (Dashboard Required)

**CRITICAL:** Schema configuration is ONLY available through WorkOS Dashboard, not via API.

Navigate to: Dashboard → Audit Logs → Event Configuration → Enable "Require metadata schema validation"

**Schema editor constraints:**
- Max 50 keys per metadata object
- Key names: max 40 characters
- Values: max 500 characters

**Three schema locations available:**
1. Root event metadata
2. Actor metadata
3. Target metadata

Each can have independent schemas. Check fetched docs for JSON Schema syntax.

### 4b: Validation Behavior

**Important:** When schema validation is enabled, events that don't match schema will be REJECTED with an error response. Plan your error handling accordingly.

## Step 5: Emit Audit Events

Use SDK method for creating audit events. Check fetched docs for:
- Exact method signature for your language
- Required vs optional fields
- Response handling

**Pattern (pseudocode):**

```
audit_event = sdk.create_audit_log_event(
  organization_id: "org_123",
  event: {
    action: "user.signed_in",
    actor: { id, name, type },
    targets: [{ id, name, type }],
    metadata: {...}  // Must match schema if validation enabled
  }
)
```

**Trap warning:** SDK methods vary by language. Do NOT copy-paste from other languages. Check YOUR language's docs.

## Step 6: Log Streams Configuration (OPTIONAL)

### When to Configure Log Streams

**Decision tree:**

```
Who needs to configure streaming?
  |
  +-- You (central config for all orgs) --> Dashboard setup (Step 6a)
  |
  +-- Customer IT admins (per-org) --> Admin Portal delegation (Step 6b)
```

### 6a: Dashboard Setup Pattern

**CRITICAL:** Configured in WorkOS Dashboard, not via SDK. Navigate to: Dashboard → Audit Logs → Log Streams

**IP allowlist requirement:** If streaming to IP-restricted hosts, allowlist these IPs:

```
3.217.146.166
23.21.184.92
34.204.154.149
44.213.245.178
44.215.236.82
50.16.203.9
```

### 6b: Provider-Specific Configuration

Check fetched docs for exact configuration requirements per provider:

**Datadog:**
- Uses HTTP Log Intake API
- Requires API key
- Supports regional endpoints

**Splunk:**
- Uses HTTP Event Collector (HEC)
- Requires HEC token
- Custom endpoint URL

**AWS S3:**
- Uses cross-account IAM role
- Requires external ID for security
- Uploads with `ContentMD5` header (Object Lock support)

**Google Cloud Storage:**
- Check fetched docs for auth requirements

**HTTP POST (generic):**
- Any endpoint URL
- Custom headers supported

### 6c: Admin Portal Delegation

To let customers configure their own streams:

1. Enable Admin Portal for organization (check fetched docs for SDK method)
2. Generate Admin Portal link (check fetched docs for SDK method)
3. Share link with customer IT admin

Customer can then self-configure log streaming without your involvement.

## Step 7: Exporting Events

For batch analysis or compliance, use export functionality. Check fetched docs for:
- Export API endpoint/SDK method
- Date range parameters
- Output format (CSV/JSON)
- Pagination handling for large exports

**Pattern:** Exports are async operations. You'll receive a URL to download results, not inline data.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup:

```bash
# 1. Environment variables exist
grep "WORKOS_API_KEY=sk_" .env* && echo "PASS: API key configured" || echo "FAIL: API key missing"

# 2. SDK installed
ls node_modules/@workos-inc 2>/dev/null && echo "PASS: SDK found" || echo "FAIL: SDK not installed"

# 3. Can emit test event (replace with your SDK's test command)
# This should return success, not throw
node -e "const { WorkOS } = require('@workos-inc/node'); const workos = new WorkOS(process.env.WORKOS_API_KEY); console.log('SDK initialized');"

# 4. If using Log Streams to IP-restricted host
# Verify IPs are allowlisted in destination system
# (Manual check required)
```

**Dashboard verification:**
- Navigate to Dashboard → Audit Logs → Events
- Confirm test events appear
- If using schemas: verify validation errors appear for malformed events

## Error Recovery

### "Metadata validation failed"

**Cause:** Event metadata doesn't match configured JSON Schema.

**Fix:**
1. Check Dashboard → Audit Logs → [Your Event] → Schema tab for exact schema
2. Verify your event payload matches ALL required fields
3. Check data types (string vs number vs boolean)
4. Verify no extra keys if `additionalProperties: false` is set

**Prevention:** Store schema locally and validate BEFORE emitting events.

### "Organization not found"

**Cause:** Invalid `organization_id` or org doesn't exist in your WorkOS account.

**Fix:**
1. List organizations via SDK (check docs for method)
2. Verify `organization_id` format matches `org_*` pattern
3. Confirm organization wasn't deleted

### Log Stream events not appearing in destination

**Checklist:**
1. Verify IP allowlist includes all 6 WorkOS IPs (Step 6a)
2. Check destination credentials (API key, token, IAM role)
3. Confirm no rate limiting on destination side
4. Check Dashboard → Log Streams for error messages

**Datadog-specific:** Verify regional endpoint matches your Datadog account region.

**S3-specific:** IAM role must have `s3:PutObject` permission and trust relationship with WorkOS account ID.

### "API key invalid"

**Cause:** Wrong key type or revoked key.

**Fix:**
1. Verify key starts with `sk_` (secret key, not publishable `pk_`)
2. Check key wasn't rotated in Dashboard → API Keys
3. Regenerate key if compromised

**Trap warning:** Do NOT use `pk_` client keys for server-side audit log operations. They lack required permissions.

### Events visible in Dashboard but not via API

**Cause:** Likely querying wrong organization or date range.

**Fix:**
1. Confirm `organization_id` matches Dashboard filter
2. Check date range parameters (events may be outside query window)
3. Verify pagination—first page may not contain your event

### Metadata exceeds limits

**Error:** "Metadata key/value too long" or "Too many keys"

**Constraints:**
- Max 50 keys per metadata object
- Key names: 40 char max
- Values: 500 char max

**Fix:** 
- Truncate long values
- Move detailed data to external storage, reference by ID in metadata
- Split into multiple events if needed

## Related Skills

- workos-authkit-nextjs (for linking audit events to authenticated users)
- workos-authkit-react (for client-side user context in audit events)
