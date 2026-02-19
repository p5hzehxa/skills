<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/vault
- https://workos.com/docs/reference/vault/key
- https://workos.com/docs/reference/vault/key/create-data-key
- https://workos.com/docs/reference/vault/key/decrypt-data
- https://workos.com/docs/reference/vault/key/decrypt-data-key
- https://workos.com/docs/reference/vault/key/encrypt-data
- https://workos.com/docs/reference/vault/object
- https://workos.com/docs/reference/vault/object/create

## Authentication Setup

Set your WorkOS API key as an environment variable:

```bash
export WORKOS_API_KEY='sk_test_...'
```

All Vault API requests require this key in the `Authorization` header:

```
Authorization: Bearer sk_test_...
```

Verify your key format:
- Test keys start with `sk_test_`
- Production keys start with `sk_live_`
- Keys are environment-specific — use separate keys for dev/staging/prod

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/data_keys` | Create a new data encryption key |
| POST | `/vault/data_keys/:id/decrypt` | Decrypt a data key for use |
| POST | `/vault/keys/:id/encrypt` | Encrypt plaintext data |
| POST | `/vault/keys/:id/decrypt` | Decrypt ciphertext data |
| POST | `/vault/objects` | Store encrypted data as a vault object |

## Operation Decision Tree

### When to Use Each Endpoint

**Creating/storing encrypted data:**
1. Create a data key → `POST /vault/data_keys`
2. Encrypt data with the key → `POST /vault/keys/:id/encrypt`
3. Store encrypted data → `POST /vault/objects` (optional — for WorkOS-managed storage)

**Retrieving/using encrypted data:**
1. Decrypt the data key → `POST /vault/data_keys/:id/decrypt`
2. Decrypt data with the key → `POST /vault/keys/:id/decrypt`

**Key rotation pattern:**
- Create new data key
- Re-encrypt data with new key
- Delete old data key reference

## Common Patterns

### Pattern 1: Encrypt-then-Store (Application-Managed Storage)

```
1. POST /vault/data_keys
   → Returns { id: "data_key_...", encrypted_key: "..." }
   
2. POST /vault/keys/{id}/encrypt
   Body: { plaintext: "sensitive data" }
   → Returns { ciphertext: "..." }
   
3. Store encrypted_key + ciphertext in your database
```

### Pattern 2: Vault-Managed Storage (WorkOS Stores Data)

```
1. POST /vault/data_keys
   → Returns { id: "data_key_..." }
   
2. POST /vault/objects
   Body: {
     data_key_id: "data_key_...",
     plaintext: { sensitive: "data" }
   }
   → WorkOS encrypts and stores the data
   → Returns { id: "vault_object_..." }
```

### Pattern 3: Decrypt for Use

```
1. Retrieve encrypted_key from your database

2. POST /vault/data_keys/{id}/decrypt
   Body: { encrypted_key: "..." }
   → Returns { plaintext_key: "..." }
   
3. POST /vault/keys/{id}/decrypt
   Body: { ciphertext: "..." }
   → Returns { plaintext: "..." }
```

## Error Handling

### Authentication Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid API key | Verify `WORKOS_API_KEY` is set and starts with `sk_` |
| 401 | Wrong environment key | Use test key for test env, live key for prod |
| 403 | Key lacks Vault permissions | Check Dashboard → API Keys → Key permissions |

### Request Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Malformed request body | Check fetched docs for exact request schema |
| 404 | Data key ID not found | Verify key ID exists and matches environment (test vs live) |
| 422 | Invalid plaintext format | Ensure plaintext is properly formatted (string for raw encryption, object for vault objects) |

### Operational Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 500 | Internal server error | Retry with exponential backoff (1s, 2s, 4s) |
| 503 | Service temporarily unavailable | Retry after 5 seconds |

## Rate Limiting

Check fetched docs for current rate limits. General strategy:

```
If response status == 429:
  wait_time = response.headers['Retry-After']
  wait(wait_time)
  retry_request()
```

## Verification Commands

### Test API Key Setup

```bash
curl https://api.workos.com/vault/data_keys \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST
```

Expected: 200 response with `{ id: "data_key_...", ... }`

### Test Encryption Flow

```bash
# Step 1: Create data key
KEY_ID=$(curl -s https://api.workos.com/vault/data_keys \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST | jq -r '.id')

# Step 2: Encrypt data
curl https://api.workos.com/vault/keys/$KEY_ID/encrypt \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"plaintext":"test data"}' \
  -X POST
```

Expected: 200 response with `{ ciphertext: "..." }`

### Test SDK Integration (Pseudocode)

```
# Initialize SDK with API key
vault = WorkOS::Vault.new(api_key: ENV['WORKOS_API_KEY'])

# Create and use a data key
data_key = vault.data_keys.create()
encrypted = vault.keys.encrypt(data_key.id, plaintext: "sensitive")
decrypted = vault.keys.decrypt(data_key.id, ciphertext: encrypted.ciphertext)

# Verify roundtrip
assert decrypted.plaintext == "sensitive"
```

Check fetched docs for SDK-specific method signatures in your language.

## Common Traps

1. **Key ID confusion** — Data key IDs (`data_key_...`) are different from vault object IDs (`vault_object_...`). Use data key IDs for encrypt/decrypt operations.

2. **Encrypted key storage** — When using Pattern 1, you MUST store the `encrypted_key` returned from `/vault/data_keys`. Without it, you cannot decrypt data later.

3. **Environment mismatch** — Test keys cannot decrypt data encrypted with live keys. Keep environments separate.

4. **Plaintext format** — `/vault/keys/:id/encrypt` expects a string. `/vault/objects` expects a JSON object. Do not confuse them.

5. **Key rotation without re-encryption** — Simply creating a new key does NOT re-encrypt existing data. You must decrypt with the old key and re-encrypt with the new key.

## Related Skills

- workos-feature-vault (feature overview and usage patterns)
