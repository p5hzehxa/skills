---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth for Vault implementation:
- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

Check environment variables:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify in Dashboard:**
- Organization exists (required for key context)
- API key has Vault permissions enabled

### Project Setup

- Confirm WorkOS SDK is installed for your language
- Confirm SDK version supports Vault (check fetched docs for minimum version)

## Step 3: Key Context Architecture (Decision Tree)

**CRITICAL:** All Vault operations require a key context. Decide your isolation strategy BEFORE writing code:

```
What is your encryption boundary?
  |
  +-- Per-organization data → Use {"organization_id": "org_123"}
  |
  +-- Per-user data → Use {"organization_id": "org_123", "user_id": "user_456"}
  |
  +-- Per-tenant + environment → Use {"organization_id": "org_123", "environment": "production"}
  |
  +-- Custom dimensions → Use up to 10 key-value pairs (all values must be strings)
```

**Key matching rules:**
- Each context item identifies a key-encrypting key (KEK)
- KEKs are created just-in-time (no pre-configuration needed)
- For BYOK setups: customer-managed key (CMK) is matched by context and used instead of WorkOS KEK
- Same context = same KEKs, but DIFFERENT data keys (DEKs) per operation

**Context limitations (enforced by API):**
- Maximum 10 items per context
- All values must be strings (no numbers, booleans, or null)
- Context cannot be changed after object creation (only value can be updated)

## Step 4: Create Encrypted Object

Use SDK method for creating Vault objects. Check fetched docs for exact signature in your language.

**Pattern:**

```
create_vault_object(
  name: string,              // Unique identifier for the object
  value: string,             // Data to encrypt (can be JSON-stringified)
  key_context: {             // Determines encryption keys
    organization_id: string,
    [additional_keys]: string
  }
)
```

**Verification after creation:**
- Object returns a version number (starts at 1)
- Subsequent updates increment version
- Store object name for future retrieval

## Step 5: Update Object Value (Consistency Lock Pattern)

**IMPORTANT:** Key context is immutable. Only value can be updated.

Use SDK update method with optional version check:

```
update_vault_object(
  name: string,
  value: string,
  expected_version?: number  // Consistency lock - update fails if version mismatches
)
```

**When to use expected_version:**
- Concurrent writes possible → Pass expected version to prevent lost updates
- Single-threaded updates → Omit for simpler code

## Step 6: Retrieve Object (Metadata vs. Value)

Choose retrieval method based on needs:

```
Need to...
  |
  +-- List all object names → Use list_vault_objects()
  |     Returns: Array of object names only
  |
  +-- Check metadata without decrypting → Use get_vault_object_metadata(name)
  |     Returns: name, version, key_context, timestamps (no value)
  |
  +-- Get decrypted value → Use get_vault_object(name)
        Returns: metadata + plaintext value
```

**Performance note:** Metadata operations are faster than full retrieval (no decryption).

## Step 7: Delete Object (Soft Delete Pattern)

Call SDK delete method. Check fetched docs for exact signature.

**Behavior:**
- Object is marked for deletion (not immediately purged)
- Object becomes unavailable to API operations immediately
- Actual data deletion happens asynchronously

**Do NOT assume:**
- Immediate physical deletion
- Ability to recreate same object name immediately after delete

## Step 8: BYOK Integration (If Required)

**Skip this step if using WorkOS-managed keys.**

```
Using customer-managed keys?
  |
  +-- Yes → Continue
  |
  +-- No → Skip to Step 9
```

**BYOK setup (one-time per customer):**

1. Customer provisions CMK in their KMS (AWS KMS, Azure Key Vault, or Google Cloud KMS)
2. Customer grants WorkOS IAM permissions to use their CMK
3. Customer configures CMK in WorkOS Dashboard with key context mapping

**Example mapping:**
- CMK `key_abc` for all data where `organization_id=organization_abc123`
- Operations with that context automatically use customer's CMK instead of WorkOS KEK

**Verify BYOK is working:**
- Check WorkOS Dashboard shows CMK as active
- Create test object with matching key context
- Confirm encryption succeeds (if CMK permissions are wrong, operation fails with permission error)

## Step 9: Local Encryption (Advanced Pattern)

**Most developers skip this step.** Use only if you need client-side encryption with Vault-managed keys.

Check fetched docs for SDK method to encrypt data locally using key context. This returns encrypted data + wrapped keys that you store yourself.

**When to use local encryption:**
- You need to encrypt data before sending to your own storage
- You want to use Vault's key management without storing objects in Vault

**When NOT to use local encryption:**
- Standard Vault object storage covers your needs → Use Steps 4-7 instead

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check SDK is installed (adjust for your package manager/language)
npm list @workos-inc/node 2>/dev/null || pip show workos || gem list workos

# 2. Check environment variables are set
printenv | grep WORKOS_API_KEY
printenv | grep WORKOS_CLIENT_ID

# 3. Test API connectivity (replace with actual org ID)
curl -X GET "https://api.workos.com/vault/objects" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"

# 4. Verify organization exists in Dashboard
# → Manual check: dashboard.workos.com > Organizations

# 5. Application builds without errors
# → Run your language's build command
```

**If check #3 fails with 401:** API key is invalid or missing Vault permissions.

**If check #3 fails with 403:** API key lacks Vault scope. Check Dashboard permissions.

## Error Recovery

### "Invalid key context" / 400 error

**Root causes:**
- Non-string values in context (e.g., numbers, booleans)
- More than 10 items in context
- Empty context object

**Fix:** Validate context before API call:

```
context = {organization_id: "org_123"}
if len(context) > 10:
  raise error
if any value is not string:
  convert to string or raise error
```

### "Object already exists" / 409 error

**Root cause:** Object name must be unique per WorkOS environment.

**Fix options:**
1. Use update instead of create if object exists
2. Generate unique names (e.g., append timestamp or UUID)
3. Delete old object before recreating (note: soft delete delay may apply)

### "Version mismatch" / 409 error on update

**Root cause:** `expected_version` parameter doesn't match current object version.

**Fix:**
1. Fetch current object metadata to get latest version
2. Retry update with correct version
3. Implement retry logic for concurrent write scenarios

### "Permission denied" / 403 error with BYOK

**Root causes:**
1. WorkOS lacks IAM permissions on customer's CMK
2. CMK is disabled or deleted
3. CMK region doesn't match WorkOS Vault region

**Fix:**
- Check customer's KMS console for WorkOS principal permissions
- Verify CMK status is "Enabled"
- Check fetched docs for supported CMK regions

### "Key not found" on decryption

**Root cause:** Object was encrypted with BYOK CMK, but CMK is no longer accessible.

**Fix:** Customer must restore CMK access. Data cannot be decrypted without original key.

### SDK import fails

- Check: SDK package installed for correct language
- Check: Import path matches SDK version (check fetched docs for breaking changes)
- Check: Minimum SDK version supports Vault

### API key starts with wrong prefix

- Check: Using `sk_` key, not `pk_` (publishable key) or `client_` (client ID)
- Check: Key is from correct WorkOS environment (staging vs. production)

## Related Skills

- **workos-audit-logs**: Audit Vault access events for compliance
