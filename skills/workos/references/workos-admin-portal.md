<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use this skill when you need to provide end-user self-service configuration UI for SSO connections, Directory Sync connections, or other enterprise features. The Admin Portal eliminates the need to build custom configuration UIs by providing a hosted, embeddable interface where your customers' IT admins can set up integrations directly.

## Key Vocabulary

- **Organization** `org_` — the tenant entity that owns SSO/Directory Sync configurations
- **Portal Link** `portal_link_` — time-limited URL granting access to the Admin Portal
- **Intent** — specifies which configuration flow to show (`sso`, `dsync`, `log_streams`, `audit_logs`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
