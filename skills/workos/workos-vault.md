---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use Vault when you need to encrypt sensitive data (PII, credentials, API keys) at rest in your database while maintaining full control over encryption keys. Vault wraps your existing data models with transparent encryption/decryption — you store opaque ciphertext, WorkOS handles key management and rotation. Reach for this when compliance requires customer-controlled encryption or when you want to externalize key management without changing your database schema.

## Documentation

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

## Key Concepts

### Core Architecture
- **Vault Items**: encrypted data blobs stored in WorkOS, referenced by `vault_` prefixed IDs
- **Key Contexts**: logical encryption boundaries (e.g., per-tenant, per-environment) — data encrypted in one context cannot be decrypted by another
- **BYOK (Bring Your Own Key)**: optional customer-managed encryption keys via AWS KMS or GCP Cloud KMS
- **Transparent encryption**: your app sends plaintext to `encrypt()`, receives ciphertext to store; sends ciphertext to `decrypt()`, receives plaintext

### ID Prefixes & Environment
- `vault_`: Vault Item IDs
- `WORKOS_API_KEY`: standard WorkOS authentication
- Key context strings: arbitrary identifiers you define (commonly `tenant_id`, `environment`, or UUIDs)

### Key Decision Points
1. **Key context strategy**: decide upfront how to partition encrypted data (per-tenant isolation vs. shared contexts)
2. **BYOK vs. WorkOS-managed**: BYOK adds operational complexity but gives customers key custody — check fetched docs for setup requirements
3. **Storage pattern**: store ciphertext in your database, never plaintext — Vault is stateless, you own the encrypted data

### Architectural Patterns
- **Encrypt on write**: before persisting sensitive data, call `encrypt()` with key context → store returned ciphertext
- **Decrypt on read**: fetch ciphertext from database → call `decrypt()` with same key context → use plaintext in memory
- **Key rotation**: WorkOS handles versioning — old ciphertext remains decryptable after rotation without re-encryption

### Common Traps
- **Key context mismatches**: using different contexts for encrypt/decrypt will fail — enforce consistency in your app logic
- **Storing plaintext**: Vault does NOT protect data you forget to encrypt — audit all write paths for sensitive fields
- **Performance**: each encrypt/decrypt is a network call — batch operations when possible, cache decrypted data in short-lived request contexts only

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
