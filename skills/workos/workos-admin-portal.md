---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use this skill when you need to provide self-service SSO and Directory Sync configuration to your customers. Admin Portal is a hosted UI that lets end users configure their own organization settings without requiring your engineering team to build custom configuration screens.

## Documentation

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

## Key Vocabulary

- **Organization** `org_` — the entity representing a customer company
- **Portal Link** — time-limited URL for accessing the Admin Portal
- **Intent** — the specific configuration flow (e.g., `sso`, `dsync`, `audit_logs`)
- **Return URL** — where users land after completing portal actions
- **Custom Branding** — logo, colors, and favicon customization for the portal
- `WORKOS_API_KEY` — server-side authentication credential

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
