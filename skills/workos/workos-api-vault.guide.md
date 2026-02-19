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

Use your WorkOS API key in the `Authorization` header:

```
Authorization: Bearer sk_your_api_key
```

All Vault API requests require authentication. The API key must have vault permissions enabled in the WorkOS Dashboard.

## Endpoint Catalog

### Key Encryption Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/keys` | Create a new data encryption key (DEK) |
| POST | `/vault/keys/:key_id/encrypt` | Encrypt plaintext data with a DEK |
| POST | `/vault/keys/:key_id/decrypt` | Decrypt ciphertext with a DEK |

### Object Storage Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/objects` | Store encrypted object with metadata |

## Operation Decision Tree

### Which approach should I use?

**For field-level encryption (email, SSN, credit card):**
1. Create DEK with `POST /vault/keys`
2. Encrypt each field with `POST /vault/keys/:key_id/encrypt`
3. Store ciphertext in your database
4. Decrypt on retrieval with `POST /vault/keys/:key_id/decrypt`

**For complete object storage (files, JSON blobs):**
1. Use `POST /vault/objects` — WorkOS handles encryption internally
2. Store returned `object_id` in your database
3. Retrieve with GET (not in current endpoint catalog — check fetched docs)

**For key rotation:**
- Create new DEK with `POST /vault/keys`
- Decrypt data with old key, re-encrypt with new key
- Update key references in your database

## Request Patterns

### Creating a Data Encryption Key

```bash
curl https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{}'
```

Returns `key_id` — store this for future encryption/decryption calls.

### Encrypting Data

```bash
curl https://api.workos.com/vault/keys/{key_id}/encrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"plaintext": "sensitive@example.com"}'
```

Returns `ciphertext` — store this in your database, NOT the plaintext.

### Decrypting Data

```bash
curl https://api.workos.com/vault/keys/{key_id}/decrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"ciphertext": "..."}'
```

Returns original `plaintext`.

### Storing Encrypted Objects

```bash
curl https://api.workos.com/vault/objects \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "data": {"email": "user@example.com", "ssn": "123-45-6789"},
    "metadata": {"user_id": "12345", "type": "pii"}
  }'
```

Returns `object_id` — store this reference, NOT the raw data.

## Error Code Mapping

### 401 Unauthorized
**Cause:** Invalid or missing API key  
**Fix:** Verify `WORKOS_API_KEY` starts with `sk_` and is set correctly

### 403 Forbidden
**Cause:** API key lacks vault permissions  
**Fix:** Enable vault feature in WorkOS Dashboard → API Keys → Edit Key → Vault

### 404 Not Found
**Cause:** `key_id` or `object_id` does not exist  
**Fix:** Verify ID format. Key IDs start with `key_`, object IDs start with `obj_`

### 422 Unprocessable Entity
**Cause:** Malformed request body (missing `plaintext`, invalid JSON)  
**Fix:** Check fetched docs for required request fields

### 429 Too Many Requests
**Cause:** Rate limit exceeded  
**Fix:** Implement exponential backoff. Check fetched docs for current rate limits.

### 500 Internal Server Error
**Cause:** WorkOS service disruption  
**Fix:** Retry with exponential backoff. Check status.workos.com for incidents.

## Verification Commands

### Test API Key Authentication

```bash
# Should return 401 with invalid key
curl -i https://api.workos.com/vault/keys \
  -H "Authorization: Bearer sk_invalid" \
  -X POST

# Should return 200 with valid key
curl -i https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -X POST
```

### Test Encryption Round-Trip

```bash
# 1. Create key
KEY_ID=$(curl -s https://api.workos.com/vault/keys \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -X POST | jq -r '.id')

# 2. Encrypt
CIPHERTEXT=$(curl -s https://api.workos.com/vault/keys/${KEY_ID}/encrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"plaintext": "test@example.com"}' | jq -r '.ciphertext')

# 3. Decrypt
curl -s https://api.workos.com/vault/keys/${KEY_ID}/decrypt \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"ciphertext\": \"${CIPHERTEXT}\"}" | jq -r '.plaintext'

# Should print: test@example.com
```

## Common Pitfalls

### Trap: Storing plaintext alongside ciphertext
**Problem:** Negates encryption benefits  
**Fix:** Store ONLY ciphertext. Decrypt on-demand for display/processing.

### Trap: Hardcoding key_id in code
**Problem:** Cannot rotate keys without code changes  
**Fix:** Store `key_id` in database alongside encrypted data. Support multiple active keys.

### Trap: Not handling decryption failures
**Problem:** Key deleted or permissions changed → data unrecoverable  
**Fix:** Implement graceful degradation. Log decryption failures for investigation.

### Trap: Encrypting already-encrypted data
**Problem:** Double encryption makes data unreadable  
**Fix:** Tag encrypted fields in your schema. Check before encrypting.

## SDK Usage Patterns

Instead of curl, use SDK methods for encryption operations:

```pseudocode
// Create DEK
key = workos.vault.keys.create()

// Encrypt field
ciphertext = workos.vault.keys.encrypt(
  key_id = key.id,
  plaintext = "sensitive@example.com"
)

// Store ciphertext in database
db.save(user_id, ciphertext)

// Later: decrypt on retrieval
plaintext = workos.vault.keys.decrypt(
  key_id = stored_key_id,
  ciphertext = db.get(user_id)
)
```

Check fetched docs for exact SDK method signatures in your language.

## Related Skills

- workos-feature-vault (feature overview and use cases)
