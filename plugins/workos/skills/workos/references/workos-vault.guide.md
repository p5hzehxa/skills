<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Encryption Model (Decision Tree)

Vault offers two encryption modes. Your choice determines setup complexity:

```
Who manages encryption keys?
  |
  +-- WorkOS manages keys (default)
  |     → Skip BYOK setup
  |     → Organizations isolated by WorkOS-managed keys
  |     → Simplest path
  |
  +-- Customer brings own keys (BYOK)
        → Requires customer KMS integration
        → Supports: AWS KMS, Azure Key Vault, Google Cloud KMS
        → Customer retains cryptographic control
        → Setup: Check fetched docs for BYOK configuration
```

**Trap warning:** BYOK requires customer IAM permissions granting WorkOS access to their KMS. This is a customer-side configuration step — your app cannot do it programmatically. Provide customers with IAM policy templates from the BYOK docs.

**For this guide:** We assume WorkOS-managed keys. For BYOK setup, check the `/byok` doc URL above.

## Step 3: Install SDK

Detect package manager, install WorkOS SDK. Check fetched docs for language-specific package name.

**Verify:** SDK package exists in dependencies before continuing.

## Step 4: Environment Variables

Check `.env` or secrets manager for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verification command:**

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid API key" || echo "✗ invalid or missing"
```

## Step 5: Organization Context (CRITICAL)

Vault encrypts data **per WorkOS organization**. Every Vault operation requires an `organization_id`.

**Decision tree: How do you get organization_id?**

```
Is the user already authenticated with WorkOS?
  |
  +-- YES (using AuthKit/SSO)
  |     → Extract organization_id from auth session
  |     → Guaranteed to exist and be valid
  |
  +-- NO (standalone Vault usage)
        → Must provision organizations via Directory Sync or Admin Portal
        → Map your internal tenant/customer ID to WorkOS organization_id
        → Store mapping in your database
```

**Trap warning:** Do NOT use your internal customer IDs directly as organization*id. WorkOS organization IDs have specific format (`org*\*`). Always map through WorkOS APIs.

**Verification command:**

```bash
# Check if organization_id is used in vault calls
grep -r "organization.*id" src/ | grep -i vault || echo "FAIL: Missing organization context"
```

## Step 6: Basic Operations

Use SDK methods for these operations. Check fetched docs for exact signatures in your language.

### Store encrypted data

SDK method for creating vaults — accepts `organization_id`, `key` (identifier), `value` (plaintext data)

### Retrieve decrypted data

SDK method for fetching vaults — accepts `organization_id`, `key`, returns decrypted plaintext

### Update existing data

SDK method for updating vaults — upsert semantics (creates if missing, updates if exists)

**Code example (language-agnostic SDK pattern):**

```
# Store sensitive data
workos.vault.create({
  organization_id: "org_123",
  key: "api_credentials",
  value: '{"api_key": "secret_value"}'
})

# Retrieve and decrypt
vault_item = workos.vault.get({
  organization_id: "org_123",
  key: "api_credentials"
})
decrypted_value = vault_item.value

# Update (upsert)
workos.vault.update({
  organization_id: "org_123",
  key: "api_credentials",
  value: '{"api_key": "new_secret"}'
})
```

**Key naming convention:** Use descriptive strings as `key` — these are how you reference encrypted data. Think of them as identifiers in a key-value store, not encryption keys.

## Step 7: Key Context Metadata

Vault supports storing metadata alongside encrypted values. This is for **non-sensitive** context about the encrypted data.

**When to use:**

- Timestamps: "when was this credential last rotated?"
- Categorization: "is this a production or staging key?"
- Ownership: "which service owns this credential?"

**When NOT to use:**

- Do NOT store sensitive data in metadata — it's not encrypted separately
- Do NOT use for user PII

Check fetched docs at `/key-context` URL for metadata API usage.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. API key format
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓" || echo "✗ FAIL"

# 2. Organization ID in code
grep -r "organization.*id" src/ | grep -i vault && echo "✓" || echo "✗ FAIL: Missing org context"

# 3. SDK imported
grep -r "workos.*vault\|vault.*workos" src/ && echo "✓" || echo "✗ FAIL: SDK not imported"

# 4. Build succeeds
npm run build && echo "✓" || echo "✗ FAIL"
```

## Error Recovery

### "organization not found"

**Root cause:** Invalid `organization_id` or organization doesn't exist in WorkOS.

**Fix:**

1. Verify organization exists in WorkOS Dashboard
2. Check organization ID format starts with `org_`
3. If using auth session: confirm user belongs to the organization
4. If standalone: create organization via Directory Sync or Admin Portal APIs first

### "unauthorized" or 401 errors

**Root cause:** API key invalid, missing, or lacks Vault permissions.

**Fix:**

1. Confirm `WORKOS_API_KEY` starts with `sk_` (not client ID)
2. Check key is not revoked in Dashboard
3. Verify key has Vault API access enabled (Dashboard → API Keys → Permissions)
4. Ensure key is for correct environment (staging vs production)

### "key not found" on retrieve

**Root cause:** Attempting to fetch vault item that doesn't exist.

**Fix:**

1. Vault operations are organization-scoped — confirm you're using same `organization_id` for store and retrieve
2. Keys are case-sensitive — verify exact string match
3. Use upsert pattern (update method) instead of separate create/fetch if unsure whether key exists

### BYOK: "kms access denied"

**Root cause:** Customer's KMS lacks IAM permissions for WorkOS.

**Fix:**

1. This is a CUSTOMER action — your app cannot fix it
2. Provide customer with IAM policy template from `/byok` docs
3. Customer must grant WorkOS principal `kms:Decrypt` and `kms:Encrypt` on their key
4. Verify with customer that IAM changes propagated (can take 5-10 minutes)

## Related Skills

- workos-authkit-nextjs (for extracting organization_id from auth sessions)
