---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

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

Set your WorkOS API key as a bearer token:

```bash
export WORKOS_API_KEY="sk_test_..."
```

All API requests must include:
```
Authorization: Bearer sk_test_...
Content-Type: application/json
```

Verify authentication works:
```bash
curl https://api.workos.com/vault/objects \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with object list (may be empty array initially).

## Endpoint Catalog

### Data Key Operations

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/key/create-data-key` | Generate encryption data key |
| POST | `/vault/key/encrypt-data` | Encrypt plaintext data |
| POST | `/vault/key/decrypt-data` | Decrypt ciphertext data |
| POST | `/vault/key/decrypt-data-key` | Decrypt encrypted data key |

### Vault Object Operations

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/vault/objects` | Create new vault object |
| GET | `/vault/objects/{object_id}` | Retrieve object by ID |
| GET | `/vault/objects` | List all objects (paginated) |
| PUT | `/vault/objects/{object_id}` | Update existing object |
| DELETE | `/vault/objects/{object_id}` | Delete object |
| GET | `/vault/objects/name/{name}` | Retrieve object by name |
| GET | `/vault/objects/{object_id}/metadata` | Get object metadata only |
| GET | `/vault/objects/{object_id}/versions` | List object version history |
| GET | `/vault/objects/{object_id}/versions/{version}` | Retrieve specific version |

## Operation Decision Tree

### When to Use Each Endpoint

**Storing sensitive data:**
```
Do you have the data ID?
├─ YES → Use PUT /vault/objects/{object_id} (update)
└─ NO → Use POST /vault/objects (create)
```

**Retrieving sensitive data:**
```
Do you know the object ID?
├─ YES → Use GET /vault/objects/{object_id}
└─ NO → Do you know the name?
    ├─ YES → Use GET /vault/objects/name/{name}
    └─ NO → Use GET /vault/objects (list and filter)
```

**Encryption key management:**
```
Need to encrypt at application layer?
├─ YES → POST /vault/key/create-data-key to generate key
│        → POST /vault/key/encrypt-data to encrypt with key
└─ NO → Store directly in vault object (WorkOS handles encryption)
```

**Version management:**
```
Need historical data?
├─ YES → GET /vault/objects/{object_id}/versions (list all)
│        → GET /vault/objects/{object_id}/versions/{version} (specific)
└─ NO → GET /vault/objects/{object_id} (current version only)
```

## Common Patterns

### Creating a Vault Object

Pseudocode pattern:
```
POST /vault/objects
Body: {
  "name": "unique-identifier",
  "data": { sensitive-fields },
  "metadata": { non-sensitive-context }
}
→ Returns: { "id": "vault_01...", ... }
```

Store the returned ID for future updates.

### Updating vs Creating

WorkOS Vault requires explicit IDs for updates. Pattern:
```
Try GET /vault/objects/name/{name}
├─ Found (200) → Use PUT /vault/objects/{id} with returned ID
└─ Not Found (404) → Use POST /vault/objects to create new
```

**Trap:** There is no upsert endpoint. You must decide create vs update.

### Encrypting Data Before Storage

When you need client-side encryption (e.g., for compliance):
```
1. POST /vault/key/create-data-key
   → Returns: { "plaintext_key": "...", "encrypted_key": "..." }
2. Use plaintext_key to encrypt data locally
3. POST /vault/objects with encrypted data
4. Store encrypted_key alongside object ID (to decrypt later)
```

To decrypt:
```
1. POST /vault/key/decrypt-data-key with encrypted_key
   → Returns: { "plaintext_key": "..." }
2. Use plaintext_key to decrypt data locally
```

**Trap:** WorkOS does NOT store the plaintext key. You must handle local encryption/decryption.

## Pagination Handling

The list objects endpoint supports cursor-based pagination:
```
GET /vault/objects?limit=50&after=vault_01...
```

Pattern for fetching all objects:
```
1. GET /vault/objects?limit=100
2. Check response for "list_metadata.after" cursor
3. If cursor exists → GET /vault/objects?limit=100&after={cursor}
4. Repeat until no "after" cursor returned
```

## Error Code Mapping

Check fetched docs for complete status code reference. Common patterns:

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid or missing API key | Verify `Authorization: Bearer sk_...` header |
| 404 | Object ID or name not found | Confirm ID/name exists via list endpoint |
| 422 | Invalid request body | Check required fields in fetched docs |
| 429 | Rate limit exceeded | Implement exponential backoff (start 1s, max 32s) |

**Trap:** 404 on GET by name means the name doesn't exist — this is NOT an error during upsert flows.

## Verification Commands

### Test Authentication
```bash
curl https://api.workos.com/vault/objects \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```
Expected: 200 with `{ "data": [...], "list_metadata": {...} }`

### Test Object Creation
```bash
curl -X POST https://api.workos.com/vault/objects \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-object","data":{"key":"value"}}'
```
Expected: 201 with object ID starting with `vault_`

### Test Object Retrieval by Name
```bash
curl https://api.workos.com/vault/objects/name/test-object \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```
Expected: 200 with object data (or 404 if not found)

### Test Data Key Generation
```bash
curl -X POST https://api.workos.com/vault/key/create-data-key \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```
Expected: 200 with `plaintext_key` and `encrypted_key` fields

## Rate Limits

Check fetched docs for current rate limit values. Implement retry logic:

```
On 429 response:
1. Extract "Retry-After" header (seconds to wait)
2. Wait specified duration
3. Retry request
4. If no header: exponential backoff (1s, 2s, 4s, 8s, 16s, 32s max)
```

## ID Prefixes

All vault object IDs start with `vault_`. Use this to validate IDs before API calls.

## Related Skills

- No related feature skills (Vault is API-only)
