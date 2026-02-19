<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

These docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required secrets:

```bash
# Verify API key format
grep "WORKOS_API_KEY=sk_" .env* || echo "FAIL: WORKOS_API_KEY must start with sk_"

# Verify client ID exists
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: WORKOS_CLIENT_ID missing"
```

**STOP if checks fail.** Vault operations require valid API credentials.

### Organization Setup

Check WorkOS Dashboard:
1. Navigate to https://dashboard.workos.com
2. Confirm at least one Organization exists
3. Note the organization ID (format: `org_xxxxx`)

**You will need this organization ID for key context in Step 5.**

## Step 3: SDK Installation

Detect language/framework and install WorkOS SDK:

```
Project type?
  |
  +-- Node.js/TypeScript --> npm install @workos-inc/node
  |
  +-- Python --> pip install workos
  |
  +-- Ruby --> gem install workos
  |
  +-- Go --> go get github.com/workos/workos-go/v4
  |
  +-- Java --> Add to pom.xml/build.gradle (check docs for Maven/Gradle syntax)
```

**Verify installation:**

```bash
# Node.js
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# Python
python -c "import workos" 2>/dev/null || echo "FAIL: SDK not installed"

# Ruby
ruby -e "require 'workos'" 2>/dev/null || echo "FAIL: SDK not installed"

# Go
go list -m github.com/workos/workos-go/v4 2>/dev/null || echo "FAIL: SDK not installed"
```

Do not write import statements until verification passes.

## Step 4: Initialize SDK Client

Import SDK and initialize with API key. Check fetched docs for exact method names per language.

**Critical:** API key should come from environment, not hardcoded.

**Pattern (language-agnostic pseudocode):**

```
import WorkOS SDK

client = WorkOS.init({
  apiKey: ENV['WORKOS_API_KEY']
})
```

## Step 5: Understanding Key Context (Decision Tree)

Key context is a metadata object that determines which encryption key encrypts your data. You MUST provide key context when creating objects.

```
Key context structure:
  |
  +-- Standard setup (WorkOS-managed keys)
  |     |
  |     +-- Use organization_id: {"organization_id": "org_xxxxx"}
  |     +-- Optional: Add custom fields up to 10 total items
  |
  +-- BYOK setup (customer-managed keys)
        |
        +-- Same structure, but WorkOS routes to customer's KMS
        +-- Match organization to CMK via Dashboard config
```

**Key context rules (enforced by API):**
- All values MUST be strings
- Maximum 10 key-value pairs
- Once object is created, key context CANNOT be changed
- Only the encrypted value can be updated

**Trap:** Trying to change key context after creation will fail. Delete and recreate instead.

## Step 6: Create Encrypted Object (Core Operation)

Use SDK method to create an encrypted object. Check fetched docs for exact method signature.

**Required parameters:**
- `key_context` — metadata object (see Step 5)
- `name` — unique identifier for this object within the organization
- `value` — the data to encrypt (string or bytes)

**Optional parameters:**
- `version` — for optimistic locking (defaults to 1)

**Pattern:**

```
vault.create_object({
  key_context: {"organization_id": "org_xxxxx"},
  name: "user_api_token",
  value: "secret_data_here"
})
```

**Returns:** Object metadata including:
- `id` — unique object identifier
- `version` — current version (starts at 1)
- `created_at` / `updated_at` — timestamps

**Trap:** The value is encrypted at rest. You cannot retrieve plaintext via Dashboard UI.

## Step 7: Retrieve Object Value

Fetch and decrypt object using SDK method. Check fetched docs for exact method signature.

**Decision tree for retrieval:**

```
What do you need?
  |
  +-- Just metadata (no decryption) --> Use list or get_metadata method
  |
  +-- Decrypted value --> Use get_object method
```

**Pattern for full retrieval:**

```
object = vault.get_object({
  key_context: {"organization_id": "org_xxxxx"},
  name: "user_api_token"
})

# object.value contains decrypted plaintext
# object.version contains current version
```

**Critical:** You MUST provide the same key_context used during creation. Mismatched context = decryption failure.

## Step 8: Update Object Value

Update encrypted value with optional version locking. Check fetched docs for exact method signature.

**Pattern with version locking (recommended):**

```
vault.update_object({
  key_context: {"organization_id": "org_xxxxx"},
  name: "user_api_token",
  value: "new_secret_data",
  expected_version: 3  # Fail if current version != 3
})
```

**Without version locking:**

```
vault.update_object({
  key_context: {"organization_id": "org_xxxxx"},
  name: "user_api_token",
  value: "new_secret_data"
})
```

**Trap:** Updates increment the version counter. If using optimistic locking, you must track the current version or handle version mismatch errors.

## Step 9: Delete Object

Mark object for deletion. Check fetched docs for exact method signature and deletion behavior.

**Pattern:**

```
vault.delete_object({
  key_context: {"organization_id": "org_xxxxx"},
  name: "user_api_token"
})
```

**Important:** Check fetched docs for:
- Whether deletion is immediate or delayed
- Whether deleted objects can be recovered
- How long deleted data persists before permanent removal

**Trap:** Deletion typically makes objects unavailable to API operations immediately, but data may not be physically erased right away.

## Step 10: BYOK Setup (Optional)

If customer wants to use their own KMS keys instead of WorkOS-managed keys:

### Prerequisites Check

Customer must have ONE of:
- AWS KMS with IAM permissions for WorkOS
- Azure Key Vault with access policies for WorkOS
- Google Cloud KMS with IAM bindings for WorkOS

### Configuration Flow

1. Navigate to WorkOS Dashboard → Vault → BYOK
2. Select KMS provider (AWS/Azure/GCP)
3. Follow provider-specific setup wizard for IAM/access policies
4. Map organization ID to customer-managed key (CMK) ARN/URI
5. Test encryption/decryption via Dashboard

**Pattern after BYOK setup:**

```
# Same API calls, but encryption routes to customer's CMK
vault.create_object({
  key_context: {"organization_id": "org_with_byok"},  # Org configured for BYOK
  name: "sensitive_data",
  value: "encrypted_with_customer_cmk"
})
```

**Trap:** Key context MUST match the organization configured for BYOK. Wrong org_id = WorkOS-managed key used instead.

Check fetched BYOK docs for:
- Exact IAM policy requirements per provider
- Key rotation procedures
- Audit logging setup

## Step 11: Local Encryption (Advanced)

Vault can generate data encryption keys (DEKs) for local encryption without storing objects in Vault storage.

**Use case:** You manage storage, but want Vault to manage keys.

**Pattern (pseudocode):**

```
# Generate plaintext + encrypted DEK
key_material = vault.encrypt_data({
  key_context: {"organization_id": "org_xxxxx"},
  plaintext: "data_to_encrypt_locally"
})

# key_material contains:
# - ciphertext (encrypted data)
# - encrypted_dek (encrypted key, store alongside ciphertext)

# Later, to decrypt:
plaintext = vault.decrypt_data({
  key_context: {"organization_id": "org_xxxxx"},
  ciphertext: key_material.ciphertext,
  encrypted_dek: key_material.encrypted_dek
})
```

Check fetched docs for exact method names (`encrypt_data`, `decrypt_data`, or similar).

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm Vault integration:

```bash
# 1. Check environment variables
grep -E "WORKOS_API_KEY=sk_|WORKOS_CLIENT_ID=" .env* && echo "PASS: Credentials configured" || echo "FAIL: Missing credentials"

# 2. Check SDK installed (adjust per language)
ls node_modules/@workos-inc/node 2>/dev/null && echo "PASS: SDK installed" || echo "FAIL: SDK not installed"

# 3. Verify WorkOS import in code (adjust grep pattern per language)
grep -r "workos" --include="*.ts" --include="*.js" --include="*.py" . && echo "PASS: SDK imported" || echo "FAIL: No SDK imports found"

# 4. Test API connectivity (requires working SDK code)
# Run your test script that calls vault.list_objects or similar
npm test # or python test_vault.py, etc.

# 5. Check build succeeds
npm run build # or equivalent build command
```

**Manual checks:**
- [ ] Can create object with key_context → returns object ID
- [ ] Can retrieve object → returns decrypted value matching input
- [ ] Can update object → version increments
- [ ] Can delete object → subsequent retrieval fails
- [ ] (If BYOK) Dashboard shows CMK mapping for organization

## Error Recovery

### "Invalid key context" on create

**Root cause:** Key context violates API limits (non-string values, >10 items).

**Fix:**
```
# Check context object
{"organization_id": "org_xxx", "user_id": "123"}  # GOOD
{"organization_id": "org_xxx", "count": 42}       # BAD - integer value
{"org": "x", "a": "1", ..., "k": "11"}            # BAD - 11 items
```

Convert all values to strings. Remove excess items.

### "Key context mismatch" on retrieve/update

**Root cause:** Provided key_context doesn't match the context used at creation.

**Fix:** Use EXACT same key_context object. Check for:
- Typos in organization_id
- Missing custom fields from original context
- Extra fields not present at creation

**Trap:** Order of keys doesn't matter, but all keys must match exactly.

### "Version mismatch" on update

**Root cause:** Provided `expected_version` doesn't match current object version.

**Fix:**
1. Retrieve current version: `object = vault.get_object(...); current_ver = object.version`
2. Retry update with current version
3. Or remove `expected_version` parameter (skip optimistic locking)

### "Permissions denied" for BYOK

**Root cause:** WorkOS doesn't have required IAM permissions on customer's KMS.

**Fix by provider:**

```
AWS KMS:
  1. Check IAM policy on CMK grants kms:Encrypt, kms:Decrypt to WorkOS principal
  2. Check key policy allows WorkOS account ID
  3. Check key is in correct region

Azure Key Vault:
  1. Check access policy grants "Encrypt" and "Decrypt" to WorkOS service principal
  2. Verify WorkOS app registration has vault contributor role
  3. Check network rules allow WorkOS IPs

GCP KMS:
  1. Check IAM binding grants cloudkms.cryptoKeyEncrypterDecrypter to WorkOS service account
  2. Verify key is in correct project/location
  3. Check API is enabled: gcloud services enable cloudkms.googleapis.com
```

Check fetched BYOK docs for exact IAM policy templates per provider.

### "Object not found" after delete

**Expected behavior:** Deleted objects are unavailable to API operations.

If this is unexpected, check if delete was called accidentally. Deleted objects cannot be recovered (check fetched docs for retention policy).

### SDK import fails

**Root cause:** Package not installed or wrong import path.

**Fix:**
```bash
# Node.js
npm install @workos-inc/node
# Check node_modules exists before importing

# Python
pip install workos
# Check with: python -c "import workos"

# Ruby
gem install workos
# Check with: ruby -e "require 'workos'"

# Go
go get github.com/workos/workos-go/v4
# Check with: go list -m github.com/workos/workos-go/v4
```

Check fetched docs for current package name (may change with major versions).

### Build fails with "WORKOS_API_KEY not defined"

**Root cause:** Environment variables not loaded in build context.

**Fix:**
1. Check `.env` file exists and contains `WORKOS_API_KEY=sk_...`
2. Ensure build tool loads env vars (e.g., `dotenv` package for Node.js)
3. For CI/CD: Add secrets to pipeline config
4. Never commit API keys to version control

## Encryption Key Architecture (Context)

Understanding the key hierarchy helps debug encryption issues:

```
Key Hierarchy:
  |
  +-- Key-Encrypting Key (KEK)
  |     |
  |     +-- Lives in HSM (Hardware Security Module)
  |     +-- One KEK per unique key_context
  |     +-- Long-lived, cannot be exported
  |     +-- Identified by key_context metadata
  |
  +-- Data-Encrypting Key (DEK)
        |
        +-- Random key generated per encryption operation
        +-- Encrypts actual data
        +-- Encrypted by KEK(s), stored with ciphertext
        +-- Many DEKs per KEK
```

**Why this matters:**
- Compromising one DEK doesn't expose all data (many DEKs per context)
- KEKs stay in HSM, never leave as plaintext
- BYOK replaces WorkOS-managed KEK with customer-managed CMK
- Key context determines which KEK/CMK is used automatically

**Trap:** Even if two objects have the same key_context, they use different DEKs. Sharing key_context doesn't mean sharing keys — it means sharing the parent KEK.

## Related Skills

- workos-directory-sync — for syncing organizational data that may need Vault encryption
- workos-audit-logs — for tracking Vault access events
