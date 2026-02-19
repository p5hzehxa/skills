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

Set your API key as an environment variable:

```bash
export WORKOS_API_KEY="sk_live_..."
```

All Vault API requests require the API key in the `Authorization` header:

```
Authorization: Bearer sk_live_...
```

Verify authentication works:

```bash
curl https://api.workos.com/vault/keys \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 OK with key list. If 401: check API key starts with `sk_` and has Vault permissions in Dashboard.

## Endpoint Catalog

### Data Key Operations

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/keys` | Create a new data encryption key |
| POST | `/vault/keys/:key_id/encrypt` | Encrypt plaintext with a specific key |
| POST | `/vault/keys/:key_id/decrypt` | Decrypt ciphertext with a specific key |

### Vault Object Operations

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/objects` | Store sensitive data (e.g., SSN, credit card) |
| GET | `/vault/objects/:object_id` | Retrieve decrypted vault object |
| PUT | `/vault/objects/:object_id` | Update existing vault object |

## Operation Decision Tree

### When to Use Data Keys vs Vault Objects

**Use Data Keys** when:
- You want to encrypt/decrypt data in your own storage
- You need fine-grained control over encryption keys
- Data schema varies and you want to handle structure

**Use Vault Objects** when:
- You want WorkOS to handle storage AND encryption
- Storing PII that must be isolated from application database
- Need compliance-friendly storage without managing keys yourself

### Create vs Update Decision

For Vault Objects:
- **POST /vault/objects** — first-time creation (returns `object_id`)
- **PUT /vault/objects/:object_id** — update existing object

There is no upsert endpoint. Track `object_id` in your database to decide which operation to use.

## Encryption Patterns

### Pattern 1: Encrypt Data with Data Key

```bash
# Pseudocode pattern
data_key = POST /vault/keys { purposes: ["encryption"] }
encrypted = POST /vault/keys/{data_key.id}/encrypt { plaintext: "sensitive" }
# Store encrypted.ciphertext in your database
# Store data_key.id to decrypt later
```

### Pattern 2: Decrypt Data with Data Key

```bash
# Pseudocode pattern
decrypted = POST /vault/keys/{key_id}/decrypt { ciphertext: stored_value }
# Use decrypted.plaintext in application
```

### Pattern 3: Store PII in Vault Object

```bash
# Pseudocode pattern
vault_object = POST /vault/objects {
  type: "pii",
  data: { ssn: "123-45-6789", dob: "1990-01-01" }
}
# Store vault_object.id in your database
# Never store actual SSN/DOB
```

### Pattern 4: Retrieve Vault Object

```bash
# Pseudocode pattern
sensitive_data = GET /vault/objects/{object_id}
# Data arrives decrypted — use immediately, do not persist
```

## Error Code Mapping

### 400 Bad Request

**Cause:** Malformed request body or missing required fields
**Fix:** Check fetched docs for required fields. Common: missing `plaintext` in encrypt, missing `ciphertext` in decrypt

### 401 Unauthorized

**Cause:** Invalid or missing API key
**Fix:** Verify `WORKOS_API_KEY` environment variable is set and starts with `sk_`. Check Dashboard → API Keys for active status

### 404 Not Found

**Cause 1:** Data key ID doesn't exist
**Fix:** Verify `key_id` matches the ID returned from POST /vault/keys

**Cause 2:** Vault object ID doesn't exist
**Fix:** Verify `object_id` was stored correctly after creation

### 422 Unprocessable Entity

**Cause:** Decryption failed — ciphertext was encrypted with different key or corrupted
**Fix:** Ensure `key_id` in decrypt request matches the key used to encrypt. Check ciphertext wasn't truncated in storage

### 429 Too Many Requests

**Cause:** Rate limit exceeded
**Fix:** Implement exponential backoff (start at 1s, double on each retry, max 32s). Check fetched docs for current rate limits

### 500 Internal Server Error

**Cause:** WorkOS service issue
**Fix:** Retry with exponential backoff. If persists >5 minutes, contact WorkOS support

## Pagination Handling

Vault API does NOT use pagination for encryption/decryption operations (single-item requests).

If listing data keys (GET /vault/keys), check fetched docs for pagination parameters — typical WorkOS pattern uses cursor-based pagination with `after` and `limit` query params.

## Verification Commands

### Verify API Key Access

```bash
curl -s https://api.workos.com/vault/keys \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length'
```

Expected: Number (0 or more). Error 401 = bad API key.

### Test Data Key Encryption Flow

```bash
# Create data key
KEY_ID=$(curl -s -X POST https://api.workos.com/vault/keys \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"purposes": ["encryption"]}' \
  | jq -r '.id')

# Encrypt test data
CIPHERTEXT=$(curl -s -X POST https://api.workos.com/vault/keys/$KEY_ID/encrypt \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"plaintext": "secret123"}' \
  | jq -r '.ciphertext')

# Decrypt and verify
curl -X POST https://api.workos.com/vault/keys/$KEY_ID/decrypt \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"ciphertext\": \"$CIPHERTEXT\"}" \
  | jq -r '.plaintext'
```

Expected: `secret123`. If mismatch: check key ID consistency.

### Test Vault Object Storage Flow

```bash
# Create vault object
OBJECT_ID=$(curl -s -X POST https://api.workos.com/vault/objects \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "pii", "data": {"test_field": "sensitive_value"}}' \
  | jq -r '.id')

# Retrieve and verify
curl https://api.workos.com/vault/objects/$OBJECT_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data'
```

Expected: `{"test_field": "sensitive_value"}`. If 404: object creation failed.

## Rate Limit Guidance

Check fetched docs for current limits. Typical WorkOS rate limits:

- Default: 100 requests/minute per API key
- Bursts allowed up to 200 requests in 10-second window

If you hit 429:
1. Parse `Retry-After` header (seconds to wait)
2. Implement exponential backoff starting at `Retry-After` value
3. For bulk operations, batch requests and add delay between batches

## Common Integration Traps

### Trap 1: Storing Plaintext After Decryption

**Wrong:** Decrypt vault object → store plaintext in database
**Right:** Decrypt → use in memory → discard. Store only `object_id`

### Trap 2: Reusing Data Keys Across Environments

Data keys created in test environment (`sk_test_...`) cannot decrypt data in production. Keep environment-specific keys separate.

### Trap 3: Losing Key ID Reference

Without the original `key_id`, you cannot decrypt data encrypted with that key. Always store `key_id` alongside ciphertext in your database schema.

### Trap 4: Not Handling Partial Failures in Batch Operations

If encrypting 100 records, handle per-record errors gracefully. One 422 shouldn't fail the entire batch — log the error and continue.

## Related Skills

- **workos-vault** — Feature overview and use cases for Vault
