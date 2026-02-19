---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use this skill when you need to generate portal links that allow your customers' IT admins to self-serve configure SSO connections, Directory Sync connections, or other WorkOS features without contacting your support team. The Admin Portal is a hosted UI that handles connection setup, testing, and management.

## Documentation

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

## Key Vocabulary

- **Organization** `org_` — the customer entity that owns connections configured via portal
- **Portal Link** `portal_link_` — time-limited URL to access the Admin Portal
- **Intent** — the portal type: `sso`, `dsync`, `log_streams`, `audit_logs`
- **Return URL** — where users land after completing portal setup

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
