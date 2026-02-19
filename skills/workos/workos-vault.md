---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use Vault when you need to encrypt and store sensitive user data (API keys, credentials, tokens) with zero-knowledge security — WorkOS cannot decrypt your data. Use Bring Your Own Key (BYOK) when compliance requires you to control encryption keys in your own KMS (AWS, GCP, Azure).

## Documentation

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

## Key Vocabulary

- **Vault Item** `vault_item_` — encrypted data record (key-value pairs)
- **Key Context** — encryption scope (per-user, per-org, etc.)
- **BYOK** — Bring Your Own Key (external KMS integration)
- **`WORKOS_API_KEY`** — server-side authentication
- **`WORKOS_CLIENT_ID`** — your WorkOS application identifier

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
