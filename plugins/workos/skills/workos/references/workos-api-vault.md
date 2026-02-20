<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use Vault when you need to encrypt sensitive data (PII, credentials, tokens) at rest while maintaining searchability and queryability. Vault provides envelope encryption (data keys + master keys) and object storage with versioning. Choose this over client-side encryption when you need server-side search or WorkOS-managed key rotation.

## Key Vocabulary

- **Vault Object** `vault_obj_` — encrypted data container with metadata and versions
- **Data Key** — ephemeral AES-256 key for encrypting individual objects
- **Master Key** — WorkOS-managed key that encrypts data keys (never exposed)
- **Object Version** `vault_obj_ver_` — immutable snapshot of object state
- **Object Metadata** — queryable key-value pairs (unencrypted)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-vault.guide.md`
