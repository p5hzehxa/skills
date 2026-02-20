<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:

1. `https://workos.com/docs/vault/quick-start`
2. `https://workos.com/docs/vault/key-context`
3. `https://workos.com/docs/vault/index`
4. `https://workos.com/docs/vault/byok`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Dashboard Configuration

Verify in WorkOS Dashboard:

- At least one Organization exists (Vault operations require an organization context)
- For BYOK: Customer key configurations are complete

## Step 3: Install SDK

Detect package manager, install WorkOS SDK package from fetched docs.

**Verify:** SDK package exists in node_modules/site-packages before continuing.

## Step 4: Encryption Strategy (Decision Tree)

Choose based on your data isolation requirements:

```
Data isolation need?
  |
  +-- Per-organization only
  |     --> Key context: {"organization_id": "org_123"}
  |     --> Single KEK per org
  |
  +-- Per-organization + per-user
  |     --> Key context: {"organization_id": "org_123", "user_id": "user_456"}
  |     --> Separate KEK per user within org
  |
  +-- Per-organization + per-resource-type
  |     --> Key context: {"organization_id": "org_123", "resource_type": "documents"}
  |     --> Separate KEK per resource type within org
  |
  +-- Custom multi-tenant isolation
        --> Key context: {"tenant_id": "...", "environment": "...", ...}
        --> Maximum 10 key-value pairs allowed
```

**Critical:** Key context is immutable after object creation. Plan your isolation strategy before writing data.

## Step 5: BYOK vs Managed Keys (Decision Tree)

```
Who owns the encryption keys?
  |
  +-- WorkOS manages keys
  |     --> Use standard Vault API
  |     --> KEKs stored in WorkOS HSMs
  |     --> No additional setup required
  |
  +-- Customer manages keys (BYOK)
        --> Configure CMK in Dashboard per organization
        --> Supported: AWS KMS, Azure Key Vault, Google Cloud KMS
        --> Check fetched BYOK docs for IAM permission requirements
        --> Key context still determines which CMK to use
```

**BYOK matching logic:** If CMK exists for organization in key context, it's used automatically. Otherwise, falls back to WorkOS-managed KEK.

**Trap:** BYOK setup requires customer IAM permissions to allow WorkOS access. Test with a non-production key first.

## Step 6: Object Lifecycle Implementation

### Create Object

Use SDK method for creating vault object. Required parameters:

- `organization_id` - WorkOS organization ID
- `object_name` - unique identifier within organization
- `key_context` - metadata determining which KEK to use (see Step 4)
- `value` - data to encrypt (string or bytes)

**Example (language-agnostic):**

```
workos.vault.object.create(
  organization_id: "org_123",
  object_name: "user_456_ssn",
  key_context: {
    "organization_id": "org_123",
    "user_id": "user_456",
    "data_type": "pii"
  },
  value: "123-45-6789"
)
```

**Returns:** Object metadata including version number and encrypted value reference.

### Update Object (Version Control Pattern)

Objects are versioned. For consistency, provide expected version when updating:

```
workos.vault.object.update(
  organization_id: "org_123",
  object_name: "user_456_ssn",
  version: 2,  // Fails if current version != 2
  value: "new-value"
)
```

**Trap:** Omitting version allows concurrent updates to overwrite each other. Always pass version for write-after-read patterns.

### Retrieve Object

Two retrieval modes:

1. **Metadata only** (no decryption): List objects or get object metadata
2. **Full object** (with decryption): Get object value

Check fetched docs for exact method names. Metadata retrieval is faster and doesn't require decryption.

### Delete Object

Deletion is soft-delete by default. Object becomes unavailable to API but data persists for recovery period.

Check fetched docs for:

- Soft vs hard delete options
- Recovery period duration
- Permanent deletion method

## Step 7: Key Context Design Patterns

### Pattern 1: Hierarchical Isolation

```
Key context for multi-level isolation:
{
  "organization_id": "org_123",
  "environment": "production",
  "service": "payments",
  "data_classification": "pci"
}
```

Each key-value pair adds another KEK to the encryption chain. Compromising one key doesn't expose data from other contexts.

### Pattern 2: Time-Based Key Rotation

```
Key context with rotation period:
{
  "organization_id": "org_123",
  "key_rotation_period": "2024-Q1"
}
```

Change rotation period value to force new KEK usage without re-encrypting existing data.

### Pattern 3: Compliance Boundaries

```
Key context for regulatory isolation:
{
  "organization_id": "org_123",
  "data_residency": "eu-west-1",
  "compliance_framework": "gdpr"
}
```

Ensures data under different compliance regimes uses separate keys.

**Limitations:**

- Maximum 10 key-value pairs per context
- All values must be strings (no nested objects, numbers, or booleans)
- Keys are case-sensitive

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
env | grep "WORKOS_API_KEY\|WORKOS_CLIENT_ID" || echo "FAIL: Missing env vars"

# 2. Verify SDK installed
npm list @workos-inc/node 2>/dev/null || pip show workos 2>/dev/null || gem list workos 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Test API connectivity (replace with actual org ID)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/vault/objects?organization_id=org_test" \
  && echo "PASS: API reachable" || echo "FAIL: API unreachable"

# 4. Verify application builds
npm run build || python -m py_compile *.py || ruby -c *.rb
```

## Error Recovery

### "organization_id not found"

**Cause:** No organization created in WorkOS Dashboard.

**Fix:**

1. Go to dashboard.workos.com
2. Create organization
3. Use returned `organization_id` in API calls

### "invalid key context: non-string value"

**Cause:** Key context contains numbers, booleans, or nested objects.

**Fix:** Convert all values to strings:

```
// WRONG
{"organization_id": "org_123", "tier": 2}

// CORRECT
{"organization_id": "org_123", "tier": "2"}
```

### "maximum key context size exceeded"

**Cause:** More than 10 key-value pairs in context.

**Fix:** Reduce context granularity. Combine related fields:

```
// WRONG (11 pairs)
{"org": "...", "user": "...", "dept": "...", "team": "...", ...}

// CORRECT (consolidate)
{"org": "...", "user": "...", "scope": "dept_engineering_team_backend"}
```

### "version mismatch" on update

**Cause:** Object was updated between read and write (optimistic locking failure).

**Fix:** Fetch current version and retry:

```
1. Get object metadata → version = N
2. Update with version = N
3. If fails, repeat from step 1
```

Do NOT retry without fetching new version — this causes infinite loops.

### BYOK: "customer key not accessible"

**Cause:** WorkOS lacks IAM permissions to customer-managed key.

**Fix:**

1. Check fetched BYOK docs for exact IAM policy required
2. Verify policy is attached to WorkOS service role
3. Test with AWS KMS DescribeKey / Azure KeyVault Get / GCP GetKeyRing
4. Check key is in same region as WorkOS Vault configuration

**Trap:** Some cloud providers have eventual consistency for IAM changes. Wait 60 seconds and retry.

### "object marked for deletion"

**Cause:** Object was soft-deleted and is in recovery period.

**Fix:** Check fetched docs for object restoration method, or wait for permanent deletion to reuse object name.

## Related Skills

For authentication context when using Vault with AuthKit:

- workos-authkit-base
