---
name: workos-api-vault
description: WorkOS Vault API endpoints — create, read, update, delete encrypted objects.
---

<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use Vault when you need encrypted key-value storage with versioning and envelope encryption. Vault provides customer-managed encryption keys (CMEKs), data key generation/decryption, and versioned object storage. Choose Vault over database encryption when you need cryptographic isolation per customer or tenant.

## Key Vocabulary

- **Vault Key** — encryption key resource used for envelope encryption
- **Vault Object `vlt_obj_`** — encrypted key-value record with versioning
- **Data Key** — ephemeral symmetric key generated from a Vault Key, used to encrypt data client-side
- **Envelope Encryption** — pattern where data is encrypted with a data key, and the data key is encrypted with a master key
- **Object Version** — immutable snapshot of a Vault Object at a point in time
- **Object Metadata** — key-value tags associated with a Vault Object for filtering/search
- **`WORKOS_API_KEY`** — required env var for Vault API authentication

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-vault.guide.md`

## Related Skills

- workos-user-management — for storing encrypted user PII in Vault Objects
- workos-webhooks — for reacting to Vault Object lifecycle events
