<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
1. https://workos.com/docs/vault/quick-start
2. https://workos.com/docs/vault/key-context
3. https://workos.com/docs/vault/index
4. https://workos.com/docs/vault/byok

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment for:
- `WORKOS_API_KEY` - must start with `sk_`
- `WORKOS_CLIENT_ID` - must start with `client_`

**Do not proceed without valid credentials.**

### SDK Availability

Verify SDK installed:
```bash
# Check SDK exists in package.json or requirements.txt or equivalent
grep -E "(workos|@workos)" package.json requirements.txt Gemfile go.mod composer.json 2>/dev/null
```

If missing, install SDK before continuing. Check fetched docs for language-specific installation.

## Step 3: Organization Setup (REQUIRED)

### Create Organization in Dashboard

Navigate to WorkOS Dashboard → Organizations → Create Organization.

**Critical:** Every Vault object MUST be associated with an organization. Do not attempt Vault operations without an org.

Note the `organization_id` - starts with `org_`. You'll use this in key context.

## Step 4: Key Context Strategy (Decision Tree)

Key context determines encryption key cardinality. Choose a strategy:

```
Data isolation level?
  |
  +-- Per organization only
  |     → Context: {"organization_id": "org_xxx"}
  |     → One KEK per org
  |
  +-- Per organization + environment
  |     → Context: {"organization_id": "org_xxx", "environment": "production"}
  |     → Separate keys for prod/staging per org
  |
  +-- Per organization + user
  |     → Context: {"organization_id": "org_xxx", "user_id": "user_xxx"}
  |     → User-level isolation within org
  |
  +-- Custom dimensions (max 10 pairs)
        → Add any string key-value pairs
        → Example: {"organization_id": "org_xxx", "region": "us-east-1", "tenant": "acme"}
```

**Trap warning:** Key context is IMMUTABLE after object creation. You cannot change context - only the encrypted value. Choose your cardinality strategy carefully.

**Limitations from docs:**
- Maximum 10 key-value pairs per context
- All values must be strings (no numbers, booleans, null)

## Step 5: Basic Operations Pattern

### Create Encrypted Object

Use SDK method for creating vault object with:
- Object name (unique identifier)
- Key context (strategy from Step 4)
- Value to encrypt (arbitrary binary/text data)

Check fetched docs for exact SDK method signature.

**Pattern:**
```
vault.create_object(
  name: unique_identifier,
  context: {"organization_id": "org_xxx"},
  value: plaintext_data
)
```

### Retrieve Object Value

Use SDK method for retrieving vault object by name.

**Critical:** Retrieval requires matching organization in key context. If you created with `org_abc`, you must retrieve with `org_abc`.

### Update Object Value

Use SDK method for updating vault object. Optionally pass expected version for optimistic locking.

**Trap warning:** You CANNOT change key context during update. Only the encrypted value can change.

### Delete Object

Use SDK method for deleting vault object by name.

**Note:** Deletion is asynchronous. Object becomes immediately unavailable but data is not instantly purged.

## Step 6: BYOK Integration (Optional)

If customer requires their own encryption keys:

### Prerequisites

Customer must have KMS in one of:
- AWS KMS
- Azure Key Vault  
- Google Cloud KMS

### Setup Pattern

1. Customer provisions CMK in their KMS
2. Customer grants WorkOS Vault IAM permissions to use the key
3. Customer provides CMK identifier to WorkOS Dashboard
4. WorkOS Dashboard → Vault Settings → Configure BYOK with CMK details

### Key Matching Behavior

Once BYOK configured for an organization:

```
Encryption operation with context {"organization_id": "org_with_byok"}
  → Uses customer's CMK automatically

Encryption operation with context {"organization_id": "org_without_byok"}
  → Uses WorkOS managed KEK
```

Matching is automatic based on key context. No code changes required.

**Trap warning:** CMK must remain accessible to WorkOS Vault. If IAM permissions are revoked, decryption will fail.

## Step 7: Key Lifecycle Understanding (Read-Only Knowledge)

You do NOT manage these manually - understanding the architecture helps debug issues:

### KEK (Key-Encrypting Key)
- Long-lived key in HSM
- Identified by key context
- Created just-in-time on first use
- Cannot be exported to plaintext

### DEK (Data-Encrypting Key)
- Random key generated per encryption operation
- Used to encrypt actual data
- DEK itself is encrypted by KEK(s)
- Encrypted DEK stored with encrypted data

**Why this matters:** If you see multiple encrypted key blobs in metadata, this is expected - one DEK encrypted by each KEK from key context.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
grep -E "(workos|@workos)" package.json requirements.txt Gemfile go.mod composer.json 2>/dev/null || echo "FAIL: SDK not found"

# 2. Check environment variables set
env | grep -E "WORKOS_API_KEY|WORKOS_CLIENT_ID" || echo "FAIL: Missing credentials"

# 3. Verify API key format
echo $WORKOS_API_KEY | grep -q "^sk_" || echo "FAIL: API key invalid format"

# 4. Test SDK import (language-specific, adjust for your stack)
# Node.js:
node -e "require('@workos-inc/node')" 2>/dev/null && echo "PASS: SDK imports" || echo "FAIL: SDK import error"
# Python:
python -c "import workos" 2>/dev/null && echo "PASS: SDK imports" || echo "FAIL: SDK import error"
```

All checks must pass before deploying Vault operations.

## Error Recovery

### "organization not found" during create/retrieve

**Root cause:** Missing or invalid `organization_id` in key context.

**Fix:**
1. List organizations in Dashboard to verify ID
2. Ensure ID starts with `org_`
3. Verify org exists before Vault operations

### "key context validation failed"

**Root cause:** Context violates constraints (>10 items, non-string values, or immutability violation).

**Fix:**
- Count key-value pairs - must be ≤10
- Stringify all values: `{"count": "5"}` not `{"count": 5}`
- For updates: do NOT change context - only value

### "decryption failed" with BYOK enabled

**Root cause:** WorkOS Vault lost access to customer CMK.

**Fix:**
1. Verify CMK exists in customer's KMS
2. Check IAM permissions grant WorkOS access
3. Test CMK accessibility from WorkOS Dashboard → Vault Settings
4. If CMK was rotated, update Dashboard configuration

### "version mismatch" during update

**Root cause:** Optimistic locking failed - object changed since last read.

**Fix:**
1. Re-fetch object to get current version
2. Retry update with new version number
3. Or omit version parameter if consistency not critical

### SDK import errors

**Node.js:** Verify `@workos-inc/node` installed, not `workos`

**Python:** Verify `workos` package installed via pip

**Ruby:** Verify `workos` gem in Gemfile

**Go:** Verify `github.com/workos/workos-go` in go.mod

Check fetched docs for language-specific package names - they vary.

## Related Skills

- workos-authkit-base - For integrating authentication before Vault usage
- workos-authkit-nextjs - If building Vault UI in Next.js app
