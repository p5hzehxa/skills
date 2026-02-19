---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

Use this skill when you need to generate time-limited portal links that allow your customers to self-configure SSO, Directory Sync, or other WorkOS integrations without manual intervention. The Admin Portal provides a white-labeled UI for connection setup.

## Documentation

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Key Vocabulary

- **Organization** `org_` — the entity whose admins will configure integrations
- **Portal Link** — a time-limited URL granting access to the Admin Portal
- **Intent** — specifies which feature to configure (`sso`, `dsync`, `audit_logs`, `log_streams`)
- **Return URL** — where to redirect after setup completion
- **Success URL** — optional alternate redirect for successful configuration
- **Provider Icons** — downloadable SVG/PNG assets for identity provider logos

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-admin-portal.guide.md`

## Related Skills

- workos-authkit-base
- workos-sso
- workos-directory-sync
