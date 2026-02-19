---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use Vault when you need to encrypt and store sensitive data (tokens, credentials, secrets) with strong isolation guarantees. Vault provides encrypted storage with key rotation, access logging, and optional bring-your-own-key (BYOK) support. Choose Vault over direct database encryption when you need audit trails of data access or want to centralize key management.

## Key Vocabulary

- **Vault Item** — encrypted data object with `vault_item_` ID prefix
- **Key Context** — isolation boundary for encryption keys; ties items to specific tenants/users
- **BYOK (Bring Your Own Key)** — use your own KMS keys instead of WorkOS-managed encryption
- **`WORKOS_API_KEY`** — environment variable for server-side SDK authentication
- **Encryption Context** — metadata associated with encrypted data (not encrypted itself)
- **Key Rotation** — periodic re-encryption with new keys (automatic for WorkOS-managed keys)
- **Vault Dashboard** — WorkOS Admin panel → Vault section for BYOK configuration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
