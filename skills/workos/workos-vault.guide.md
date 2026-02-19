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

Check for required credentials:

```bash
# Verify API key format
echo $WORKOS_API_KEY | grep -q '^sk_' || echo "FAIL: WORKOS_API_KEY must start with sk_"

# Verify client ID exists
test -n "$WORKOS_CLIENT_ID" || echo "FAIL: WORKOS_CLIENT_ID not set"
```

### WorkOS Dashboard Setup

Before writing code, confirm in Dashboard:

1. Organization exists with correct organization_id
2. If using BYOK: Customer key configuration is complete with CMK ARN/identifier
3. IAM permissions grant WorkOS access to customer keys (BYOK only)

## Step 3: Install SDK

Detect package manager, install WorkOS SDK. See fetched docs for language-specific package names.

**Verify:** SDK package exists before importing.

```bash
# Check SDK installed (adjust for your package manager/language)
npm list @workos-inc/node 2>/dev/null || echo "SDK not found"
```

## Step 4: Key Context Architecture (Decision Tree)

Key context determines which keys encrypt your data. Plan this BEFORE creating objects.

```
What's your isolation boundary?
  |
  +-- Per-organization only
  |   --> {"organization_id": "org_123"}
  |   
  +-- Per-organization + per-tenant
  |   --> {"organization_id": "org_123", "tenant_id": "tenant_456"}
  |
  +-- Per-user within organization
  |   --> {"organization_id": "org_123", "user_id": "user_789"}
  |
  +-- Custom hierarchy (max 10 key-value pairs)
      --> {"organization_id": "org_123", "region": "us-west", "env": "prod"}
```

**Critical rules:**
- Key context is IMMUTABLE once object is created
- All values must be strings
- Max 10 items per context
- Same context = same KEK (key-encrypting key)

**BYOK note:** If you configured a CMK for `organization_abc`, context `{"organization_id": "organization_abc"}` uses the CMK. Context `{"organization_id": "organization_xyz"}` uses WorkOS-managed KEK.

## Step 5: Create Encrypted Objects

Use SDK method for creating Vault objects. See fetched docs for exact method signature in your language.

**Pattern:**

```
SDK.vault.create({
  key_context: {"organization_id": "org_123"},  // Determines KEK
  name: "user_payment_token",                   // Object identifier
  value: "sensitive_data_blob"                  // Data to encrypt
})
```

**Behind the scenes (no action needed):**
- Vault generates random DEK (data-encrypting key)
- DEK encrypts your data
- KEK(s) from key_context encrypt the DEK
- Encrypted DEK stored with encrypted data
- All keys stay in HSM (never exported as plaintext)

## Step 6: Read/Update/Delete Objects

### Retrieve Object

See fetched docs for SDK methods:
- List objects (returns names only)
- Get metadata (no decryption)
- Get value (decrypts and returns data)

### Update Object

**Constraint:** Key context CANNOT be changed after creation. Only value can be updated.

**Optional:** Pass expected version as consistency lock to prevent lost updates.

### Delete Object

Marks object for deletion (not immediate). Object becomes unavailable to API operations.

## Step 7: BYOK Setup (Optional)

If customers bring their own keys from AWS KMS / Azure Key Vault / Google Cloud KMS:

### In WorkOS Dashboard
1. Navigate to Vault settings
2. Add customer key configuration with CMK identifier
3. Note which organization(s) map to this CMK

### IAM Permissions (CRITICAL)
Check fetched docs for exact IAM policy requirements. WorkOS needs:
- Decrypt permission on customer CMK
- Generate data key permission
- (Provider-specific permissions — see BYOK doc)

**Verification command:**
```bash
# Test WorkOS can access CMK (use provider CLI)
# AWS example:
aws kms describe-key --key-id <cmk-arn> --query 'KeyMetadata.KeyState'
# Should return "Enabled"
```

## Verification Checklist (ALL MUST PASS)

Run these checks before marking complete:

```bash
# 1. Environment variables set correctly
test -n "$WORKOS_API_KEY" && echo $WORKOS_API_KEY | grep -q '^sk_' && echo "PASS: API key" || echo "FAIL: API key"

# 2. SDK installed
# Adjust for your language/package manager
npm list @workos-inc/node >/dev/null 2>&1 && echo "PASS: SDK installed" || echo "FAIL: SDK not found"

# 3. Can reach Vault API (simple connectivity test)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/vault/objects | grep -q '200\|401' && echo "PASS: API reachable" || echo "FAIL: Cannot reach API"

# 4. (BYOK only) Customer key accessible
# Use provider CLI to verify WorkOS IAM permissions
```

## Error Recovery

### "Invalid key context"

**Root cause:** Key context violates constraints.

**Fix:**
- Check all values are strings (not numbers/booleans)
- Check max 10 items
- Check keys are valid identifiers (no special chars)

### "Key context mismatch" on update

**Root cause:** Trying to change key_context on existing object.

**Fix:** Key context is immutable. Must delete old object and create new one with different context.

### "CMK not found" (BYOK)

**Root cause:** WorkOS cannot access customer key.

**Fix:**
1. Verify CMK identifier is correct in Dashboard
2. Check IAM policy grants WorkOS necessary permissions
3. Check CMK is in "Enabled" state (not disabled/pending deletion)
4. Verify WorkOS principal ARN/identity is correct in IAM policy

See fetched BYOK doc for provider-specific IAM policy examples.

### "Consistency lock failed" on update

**Root cause:** Object version changed between read and write (concurrent modification).

**Fix:** Re-fetch object to get current version, then retry update with new version number.

### SDK import fails

**Root cause:** Package not installed or wrong import path.

**Fix:**
1. Confirm SDK package in node_modules (or equivalent)
2. Check fetched docs for correct import path for your SDK version
3. Verify SDK version supports Vault (older versions may not)

## Related Skills

- workos-authkit-nextjs (for combining Vault with auth flows)
- workos-authkit-react (for client-side integration with Vault-backed data)
