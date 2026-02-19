---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

The Admin Portal API generates short-lived links for IT admins to configure SSO, Directory Sync, or other integrations via WorkOS's hosted UI. Use this when you want to delegate connection setup to end-user admins without building your own configuration screens, or when you need to fetch provider icons for custom UIs.

## Key Vocabulary

- **Portal Link** — time-limited URL granting access to the Admin Portal for a specific organization
- **Organization `org_`** — the WorkOS entity whose admin will configure connections
- **Intent** — the portal workflow type (e.g., `sso`, `dsync`, `audit_logs`)
- **Return URL** — the URL where WorkOS redirects admins after completing setup
- **Success URL** — optional override for successful configuration flows
- **Provider icons** — logo images for identity providers (Google, Okta, etc.)

## Documentation

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-admin-portal.guide.md`
