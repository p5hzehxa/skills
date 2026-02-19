<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both variables are set before proceeding. Vault API calls will fail without valid credentials.

### Dashboard Setup (Organization Required)

**CRITICAL:** Vault objects are scoped to WorkOS Organizations. You MUST have at least one organization created in the WorkOS Dashboard before storing encrypted data.

Navigate to: https://dashboard.workos.com/organizations

If no organizations exist, create one now. The `organization_id` will be used in key context.

## Step 3: Architecture Decision — BYOK vs WorkOS-Managed Keys

```
Key management model?
  |
  +-- WorkOS-managed KEKs --> Skip to Step 4 (default setup)
  |                           Keys live in WorkOS HSMs
  |                           No customer key configuration needed
  |
  +-- BYOK (customer keys) --> Follow BYOK guide in fetched docs
                               Requires AWS KMS / Azure Key Vault / GCP KMS setup
                               Customer retains key control and revocation
```

**Decision factors:**

- **Use WorkOS-managed** if: Standard multi-tenant SaaS, no regulatory requirement for customer key control
- **Use BYOK** if: Enterprise contract requires customer key ownership, compliance mandates (GDPR right to erasure via key deletion), customer wants independent key rotation

**BYOK setup is out of scope for this guide** — check fetched BYOK docs for IAM permissions and CMK configuration.

## Step 4: Install SDK

Detect package manager, install WorkOS SDK. Check fetched docs for exact package name and installation command.

**Verify:** SDK package exists in dependency list before writing imports.

## Step 5: Key Context Pattern (Decision Tree)

Every Vault operation requires a **key context** — a JSON object that determines which encryption key(s) to use. The key context is metadata, not secret data.

```
What data are you encrypting?
  |
  +-- Organization-scoped (most common)
  |   → Key context: {"organization_id": "org_123"}
  |   → Each org gets cryptographically isolated keys
  |   → Use case: Customer secrets, API tokens, PII
  |
  +-- User-scoped
  |   → Key context: {"organization_id": "org_123", "user_id": "user_456"}
  |   → Finer-grained isolation
  |   → Use case: User-specific credentials, personal data
  |
  +-- Resource-scoped
  |   → Key context: {"organization_id": "org_123", "resource_type": "database"}
  |   → Group related objects
  |   → Use case: Connection strings, service account keys
```

**CRITICAL RULES:**

1. **Key context is immutable after creation** — you CANNOT change it later, only update the value
2. **All values must be strings** — no integers, booleans, or nested objects
3. **Maximum 10 key-value pairs** per context
4. **organization_id is conventional** but not enforced — Vault doesn't validate the keys, only uses them for key matching

**Trap:** If you create an object with `{"org_id": "abc"}` and later try to retrieve it with `{"organization_id": "abc"}`, you'll get a "not found" error. The exact key names must match.

## Step 6: CRUD Operations Pattern

Vault operations follow this conceptual flow (check fetched docs for exact SDK method signatures):

### Create Object

```
SDK method for creating object:
  - name: string (unique within key context)
  - value: string (the data to encrypt)
  - key_context: object (determines encryption key)

Returns: object metadata including ID and version
```

**Naming convention:** Use descriptive names like `"stripe_api_key"` or `"postgres_connection_string"`. Names are scoped to key context — two different organizations can have objects with the same name.

### Update Object (Optimistic Locking)

```
SDK method for updating object:
  - id: string (from create response)
  - value: string (new encrypted value)
  - expected_version: integer (optional consistency lock)

Returns: new version number
```

**Trap:** If you omit `expected_version` and two processes update simultaneously, last write wins (data loss). Always pass `expected_version` from your read operation for safe updates.

### Retrieve Object

Three SDK methods — check fetched docs for exact names:

1. **List objects** — returns names only (no decryption)
2. **Get object metadata** — returns ID, version, timestamps (no decryption)
3. **Get object value** — returns metadata + decrypted value

**Performance note:** Use metadata queries when you only need to check if an object exists or get its version. Decryption is slower.

### Delete Object

```
SDK method for deleting object:
  - id: string

Behavior: Soft delete (object unavailable immediately but data not purged)
```

**Important:** Deletion makes the object inaccessible to API operations instantly, but the encrypted data persists in storage temporarily. This is NOT immediate physical deletion.

## Step 7: Local Encryption Pattern (Advanced)

For applications that need to encrypt data locally (e.g., encrypt before sending to a third-party API), Vault provides a local encryption SDK method.

Check fetched docs for SDK method signature. Pattern:

```
SDK method for local encryption:
  - data: string (plaintext to encrypt)
  - key_context: object (same as object creation)

Returns: encrypted blob (store this wherever needed)

SDK method for local decryption:
  - encrypted_data: string (the blob)
  - key_context: object (must match encryption context)

Returns: plaintext string
```

**Use case:** Encrypt Stripe webhook payloads before storing in your database, decrypt on read. The data never leaves your application in plaintext.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables are set
env | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"

# 2. Check SDK is installed (adjust package name to match your language)
npm list @workos-inc/node 2>/dev/null || echo "Check SDK installation"

# 3. Verify WorkOS Dashboard organization exists
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | grep -q "data" && echo "PASS: API reachable"

# 4. Build succeeds
npm run build || cargo build || mvn compile
```

**If check #3 fails:** Verify API key is correct and has appropriate permissions in WorkOS Dashboard.

## Error Recovery

### "Object not found" on retrieve

**Most common causes:**

1. **Key context mismatch** — Check that EXACT same key-value pairs (including key names) were used in create and retrieve
2. **Wrong organization_id** — Verify you're querying the same org where the object was created
3. **Object was deleted** — Check if a delete operation occurred

**Debug command:**

List all objects for the key context (check fetched docs for exact SDK method). If the object appears in the list but not in get, the key context is wrong.

### "Version conflict" on update

**Cause:** Another process updated the object between your read and write.

**Fix:** Re-fetch the object to get the latest version, merge your changes, and retry the update with the new `expected_version`.

**Prevention:** Always use `expected_version` parameter for updates in concurrent environments.

### "Invalid key context" error

**Causes:**

1. **Non-string value** — Check that all values in the context object are strings, not integers or booleans
   - Wrong: `{"organization_id": 123}`
   - Correct: `{"organization_id": "123"}`
2. **Too many keys** — Maximum 10 key-value pairs
3. **Nested objects** — Key context must be flat

**Fix:** Stringify numeric values and flatten any nested structures.

### BYOK decryption failure

**Cause:** Customer key was deleted or IAM permissions were revoked.

**Effect:** Encrypted data becomes inaccessible (this is by design — customer key deletion = data erasure).

**Recovery:** If the key deletion was accidental and a backup exists, restore the CMK with the same ID. If intentional, the data is irrecoverable (this is the security guarantee of BYOK).

### "Authentication failed" / 401 errors

**Causes:**

1. **Wrong API key** — Verify `WORKOS_API_KEY` starts with `sk_` (not `pk_` which is publishable key)
2. **Staging vs production** — Check that key matches the environment (staging keys don't work in production API)
3. **Revoked key** — Verify key is active in WorkOS Dashboard

**Debug:** Test API key with a simple organizations list call (check verification checklist above).

### High latency on decrypt operations

**Expected behavior:** Decryption involves HSM operations and is slower than metadata queries.

**Optimization patterns:**

1. **Batch retrieves** if SDK supports it (check fetched docs)
2. **Cache decrypted values** in application memory if appropriate for your security model
3. **Use metadata queries** when you only need to check object existence

## Key Context Design Patterns

### Multi-Tenant SaaS (Recommended)

```json
{
  "organization_id": "org_123"
}
```

Each customer org gets cryptographically isolated keys. Simplest and most common pattern.

### User-Specific Secrets

```json
{
  "organization_id": "org_123",
  "user_id": "user_456"
}
```

Finer-grained isolation. Use when users within an org should not access each other's data.

### Environment Separation

```json
{
  "organization_id": "org_123",
  "environment": "production"
}
```

Separate encryption keys for staging vs production data.

### Hybrid (Organization + Resource Type)

```json
{
  "organization_id": "org_123",
  "resource_type": "api_credentials"
}
```

Group related secrets together while maintaining org isolation.

**Decision factors:**

- **More key context pairs = more key isolation** but also more key management overhead
- **Fewer pairs = simpler model** but less granular access control
- **Start simple** (just organization_id), add complexity only when needed

## Related Skills

- workos-authkit-nextjs — If using Vault with Next.js authentication
- workos-authkit-react — If using Vault with React authentication
