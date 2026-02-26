<!-- refined:sha256:b0e35dadd589 -->

# WorkOS Vault

## When to Use

Use this skill when you need to securely store and retrieve sensitive data like API keys, passwords, or tokens. Vault provides encrypted storage with fine-grained access controls, eliminating the need to manage encryption infrastructure yourself.

## Key Vocabulary

- **Secret** `secret_` — encrypted credential or sensitive value
- **Vault Connection** `vault_conn_` — links Vault to a specific organization
- **Secret Version** — immutable snapshot of a secret's value at a point in time
- **Secret Path** — hierarchical identifier for organizing secrets (e.g., `api/stripe/key`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-vault.guide.md`

## Related Skills

- **workos-audit-logs**: Audit data access
