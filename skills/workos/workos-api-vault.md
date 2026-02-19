---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use Vault API when you need to encrypt/decrypt sensitive data server-side or store encrypted objects with WorkOS-managed keys. This is a low-level encryption primitive — if you need to store user credentials or secrets tied to organizations, consider Directory Sync or User Management APIs instead.

## Documentation

- https://workos.com/docs/reference/vault
- https://workos.com/docs/reference/vault/key
- https://workos.com/docs/reference/vault/key/create-data-key
- https://workos.com/docs/reference/vault/key/decrypt-data
- https://workos.com/docs/reference/vault/key/decrypt-data-key

## Key Vocabulary

- **Vault Object** — encrypted storage unit with metadata (no ID prefix documented)
- **Data Key** — ephemeral encryption key for client-side operations
- **Object Name** — unique string identifier for retrieving objects by name
- **Object Version** — immutable snapshot created on each update
- `WORKOS_API_KEY` — server-side authentication for Vault operations

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-vault.guide.md`

## Related Skills

_None — Vault is a standalone encryption primitive._
