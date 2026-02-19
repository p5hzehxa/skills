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
export WORKOS_API_KEY='sk_live_...'
```

All Vault API requests require this key in the `Authorization` header:

```
Authorization: Bearer sk_live_...
```

The SDK handles this automatically when you initialize the client with `WORKOS_API_KEY`.

## Endpoint Catalog

The Vault API provides two resource types: **Keys** (encryption key management) and **Objects** (encrypted data storage).

### Key Management Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/keys` | Create a new data encryption key |
| POST | `/vault/keys/encrypt` | Encrypt data with a specific key |
| POST | `/vault/keys/decrypt` | Decrypt data with a specific key |

### Object Storage Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/objects` | Store encrypted data as a Vault object |

## Operation Decision Tree

```
Need to encrypt sensitive data?
├─ Have encryption infrastructure already?
│  └─ YES → Use Keys API (bring your own key management)
│     ├─ Create key: POST /vault/keys
│     ├─ Encrypt: POST /vault/keys/encrypt
│     └─ Decrypt: POST /vault/keys/decrypt
│
└─ NO → Use Objects API (WorkOS manages keys)
   └─ Store encrypted: POST /vault/objects
      (WorkOS handles key creation, rotation, encryption)
```

**Key vs Object decision:**
- Use **Keys API** when you need explicit control over encryption keys and their lifecycle
- Use **Objects API** when you want WorkOS to handle key management transparently

## Keys API Patterns

### Creating a Data Encryption Key

```bash
curl https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Check fetched docs for required parameters and response schema.

### Encrypting Data

```bash
curl https://api.workos.com/vault/keys/encrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "key_...",
    "data": "sensitive_value"
  }'
```

Returns ciphertext that can only be decrypted with the same key ID.

### Decrypting Data

```bash
curl https://api.workos.com/vault/keys/decrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "key_...",
    "ciphertext": "encrypted_value"
  }'
```

## Objects API Pattern

Store encrypted data without managing keys yourself:

```bash
curl https://api.workos.com/vault/objects \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "ssn": "123-45-6789",
      "credit_card": "4242424242424242"
    }
  }'
```

WorkOS returns an object ID (`vault_obj_...`) that you store in your database. The actual sensitive data never touches your systems.

## Error Code Mapping

### 401 Unauthorized
**Cause:** Invalid or missing API key  
**Fix:** Verify `WORKOS_API_KEY` starts with `sk_` and is set in environment

### 400 Bad Request
**Cause:** Malformed request body or missing required fields  
**Fix:** Check fetched docs for required parameters for the specific endpoint

### 404 Not Found
**Cause:** Key ID or object ID does not exist  
**Fix:** Verify the resource ID format (`key_...` or `vault_obj_...`) and that it was created in the same environment

### 422 Unprocessable Entity
**Cause:** Invalid data format or encryption failure  
**Fix:** For Keys API, ensure data and ciphertext match. For Objects API, verify data is valid JSON

### 429 Too Many Requests
**Cause:** Rate limit exceeded  
**Fix:** Check fetched docs for current rate limits. Implement exponential backoff (initial 1s delay, double on each retry, max 32s)

### 500 Internal Server Error
**Cause:** WorkOS service issue  
**Fix:** Retry with exponential backoff. If persistent, contact WorkOS support with request ID from response headers

## Rate Limits and Retries

Check fetched docs for current rate limits (typically per-second and per-minute quotas).

**Retry strategy for transient errors (429, 500, 503):**

```
attempt = 0
while attempt < 5:
    response = call_vault_api()
    if response.status in [429, 500, 503]:
        wait = min(2^attempt, 32)  # exponential backoff, max 32s
        sleep(wait)
        attempt += 1
    else:
        break
```

Never retry 4xx errors except 429 — they indicate request problems that won't resolve with retries.

## Verification Commands

### 1. Test API authentication

```bash
curl -I https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Expected: 200 OK or 405 Method Not Allowed (means auth succeeded)
# Failure: 401 Unauthorized (check API key)
```

### 2. Create and encrypt test data (Keys API)

```bash
# Create key
KEY_RESPONSE=$(curl -s https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}')

KEY_ID=$(echo $KEY_RESPONSE | jq -r '.key')

# Encrypt test data
curl https://api.workos.com/vault/keys/encrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"key\": \"$KEY_ID\", \"data\": \"test_value\"}"

# Expected: JSON with ciphertext field
```

### 3. Store encrypted object (Objects API)

```bash
curl https://api.workos.com/vault/objects \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "test_field": "test_value"
    }
  }'

# Expected: JSON with object ID starting with vault_obj_
```

## SDK Integration Patterns

### Keys API pseudocode

```python
# Create encryption key
key_response = workos.vault.keys.create()
key_id = key_response['key']

# Encrypt sensitive data
encrypted = workos.vault.keys.encrypt(
    key=key_id,
    data="sensitive_value"
)
ciphertext = encrypted['ciphertext']

# Store ciphertext + key_id in your database
save_to_db(ciphertext=ciphertext, key_id=key_id)

# Later: decrypt
decrypted = workos.vault.keys.decrypt(
    key=key_id,
    ciphertext=ciphertext
)
plaintext = decrypted['data']
```

### Objects API pseudocode

```python
# Store encrypted object
vault_response = workos.vault.objects.create(
    data={
        'ssn': '123-45-6789',
        'credit_card': '4242424242424242'
    }
)
object_id = vault_response['id']  # vault_obj_...

# Store only the object_id in your database
save_to_db(vault_object_id=object_id)

# To retrieve: use object_id with Vault retrieval endpoint
# Check fetched docs for retrieval endpoint details
```

Check fetched docs for exact SDK method signatures in your language.

## Common Traps

### Trap 1: Storing plaintext after encryption
**Wrong:** Save both plaintext and ciphertext  
**Right:** Save only ciphertext (Keys API) or object ID (Objects API). Discard plaintext immediately.

### Trap 2: Mixing key IDs across environments
Keys created in test mode (`sk_test_...`) cannot decrypt data encrypted in live mode (`sk_live_...`).  
**Fix:** Use environment-specific key storage and never share keys across environments.

### Trap 3: Not handling key rotation
If you rotate encryption keys, old ciphertexts cannot be decrypted with new keys.  
**Fix:** Implement versioned key storage or re-encrypt data when rotating keys.

### Trap 4: Logging encrypted data
Ciphertexts are opaque but still sensitive (they reveal data existence and size).  
**Fix:** Redact ciphertexts in logs. Log only key IDs and operation types.

## ID Prefixes

- Keys: `key_...`
- Vault objects: `vault_obj_...`

If you see different prefixes, you're calling the wrong API or using the wrong environment.

## Related Skills

- N/A (Vault is a standalone encryption service without feature-layer skills)
