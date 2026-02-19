---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use Vault when you need to encrypt and store sensitive data (PII, credentials, tokens) with field-level encryption and access control. Vault provides two patterns: **object storage** (encrypted JSON blobs with automatic versioning) and **client-side encryption** (data keys you encrypt/decrypt in your application). Choose object storage when WorkOS should handle encryption/decryption server-side; choose client-side encryption when you need to encrypt data before it leaves your infrastructure.

## Key Concepts

### Core Resources
- **Vault Object** — encrypted JSON blob stored in WorkOS with automatic versioning; identified by `vault_obj_` prefix
- **Data Key** — AES-256 encryption key for client-side encryption; WorkOS returns plaintext + ciphertext versions
- **Object Version** — immutable snapshot of a vault object; every update creates a new version
- **Object Name** — optional human-readable identifier for vault objects (alternative to ID lookup)

### ID Prefixes
- `vault_obj_` — Vault Object ID
- `vault_ver_` — Vault Object Version ID

### Environment Variables
- `WORKOS_API_KEY` — API key with Vault permissions (required)
- `WORKOS_CLIENT_ID` — Client ID for SDK initialization (optional for Vault operations)

### Access Patterns
- **Direct encryption** — POST `/vault/object/create` with plaintext JSON; WorkOS encrypts and stores
- **Client-side encryption** — POST `/vault/key/create-data-key` to get encryption key; encrypt data locally; store ciphertext in your DB
- **Metadata filtering** — attach `metadata` object to vault objects for queryable tags (not encrypted)
- **Version pinning** — use `version` parameter in GET requests to retrieve specific historical versions

### Architectural Decisions
- Use object storage when you need versioning, metadata search, or centralized key management
- Use client-side encryption when data must never leave your infrastructure unencrypted
- Store vault object IDs in your database; use object names only for human-readable references
- Always verify API key has Vault permissions before deployment — invalid keys fail silently on some endpoints

### Common Traps
- Vault object `data` field must be valid JSON — primitives (strings, numbers) are not supported
- Deleting a vault object deletes ALL versions — use versioning to recover from accidental updates, not deletes
- Metadata is NOT encrypted — never put sensitive data in metadata fields
- Data keys are single-use — call `create-data-key` per encryption operation; do not reuse keys across records

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-vault.guide.md`
