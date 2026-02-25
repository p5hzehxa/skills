<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use this skill when you need to provide self-service configuration UIs for SSO connections, Directory Sync, or Domain Verification without building custom admin interfaces. The Admin Portal generates short-lived, scoped links that give customers secure access to configure their organization's settings.

## Key Vocabulary

- **Organization** `org_` — tenant container for connections and directories
- **Portal Link** `portal_link_` — time-limited URL for customer access
- **Intent** — scope of portal access (`sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
