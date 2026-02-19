---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use this skill when you need to encrypt, decrypt, or manage sensitive data using WorkOS Vault. This API provides cryptographic operations (data keys, encryption/decryption) and secure object storage with versioning. Reach for this when handling PII, credentials, or other secrets that require encryption at rest.

## Documentation

- https://workos.com/docs/reference/vault
- https://workos.com/docs/reference/vault/key
- https://workos.com/docs/reference/vault/key/create-data-key
- https://workos.com/docs/reference/vault/key/decrypt-data
- https://workos.com/docs/reference/vault/key/decrypt-data-key

## Key Vocabulary

- **Vault Object** — encrypted data record with metadata
- **Data Key** — cryptographic key for encryption/decryption operations
- **Object Version** — immutable snapshot of object state
- **Object Name** — user-defined identifier for retrieval
- **Metadata** — key-value pairs attached to vault objects

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-vault.guide.md`

## Related Skills

_(None defined for Vault API)_
