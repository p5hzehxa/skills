<!-- refined:sha256:59789ab29ba2 -->

# WorkOS Vault API Reference

## When to Use

Use the Vault API when you need to encrypt sensitive data at rest or manage encryption keys programmatically. This skill provides endpoints for creating data encryption keys (DEKs), encrypting/decrypting data, and storing encrypted objects with metadata. It is NOT for storing secrets like API keys — use environment variables or secret managers for those.

## Key Vocabulary

- **Data Encryption Key (DEK)** — ephemeral key for encrypting specific data blobs, encrypted by WorkOS KEK
- **Key Encryption Key (KEK)** — master key managed by WorkOS, never exposed to your application
- **Vault Object** — encrypted data blob with metadata, referenced by `object_id` or `name`
- **Object Version** — immutable snapshot of a Vault object, created on every update
- **Encrypted Data Key** — DEK encrypted by KEK, safe to store alongside ciphertext

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-vault.guide.md`
