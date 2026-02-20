<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use Vault when you need to store sensitive data (API keys, tokens, credentials) with encryption at rest and granular access controls. Vault is designed for applications that handle third-party credentials on behalf of users or need to meet compliance requirements for secrets management.

## Key Vocabulary

- **Vault Item** `vitem_` — encrypted key-value store entry
- **Vault Key** `vkey_` — encryption key for vault items
- **Secret Type** — predefined schema for common credential types (e.g., `api_key`, `oauth_token`)
- **Access Policy** — rules defining which users/services can decrypt specific vault items

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
