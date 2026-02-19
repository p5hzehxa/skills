---
name: workos-vault
description: Encrypt, store, and manage sensitive data with WorkOS Vault.
---

<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use this skill when you need to store and retrieve sensitive data (API keys, tokens, database credentials) with encryption at rest and optional Bring Your Own Key (BYOK) control. Vault provides secure key-value storage with version history and audit trails, designed for secrets that applications need to fetch at runtime.

## Documentation

- https://workos.com/docs/vault/quick-start
- https://workos.com/docs/vault/key-context
- https://workos.com/docs/vault/index
- https://workos.com/docs/vault/byok

## Key Vocabulary

- **Vault Item** `vault_item_` — encrypted key-value pair with version history
- **Key Context** — application-specific namespace for organizing vault items
- **BYOK (Bring Your Own Key)** — customer-managed encryption keys stored in external KMS
- **Vault Version** — immutable snapshot of a vault item at a point in time

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
