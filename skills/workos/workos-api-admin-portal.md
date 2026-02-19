---
name: workos-api-admin-portal
description: WorkOS Admin Portal API endpoints — generate portal links for customer self-service.
---

<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

Use this skill when you need to generate Admin Portal links that allow end-user organizations to self-configure SSO, Directory Sync, or other WorkOS integrations. The Admin Portal provides a white-labeled UI for customer-facing configuration without requiring you to build custom admin interfaces.

## Documentation

- https://workos.com/docs/reference/admin-portal
- https://workos.com/docs/reference/admin-portal/portal-link
- https://workos.com/docs/reference/admin-portal/portal-link/generate
- https://workos.com/docs/reference/admin-portal/provider-icons

## Key Vocabulary

- **Organization** — entity that owns configurations; ID prefix `org_`
- **Portal Link** — short-lived URL for accessing the Admin Portal
- **Intent** — the configuration flow to show (`sso`, `dsync`, `log_streams`, `domain_verification`, `audit_logs`)
- **Return URL** — where to redirect users after completing configuration
- **Provider Icons** — endpoint for fetching SSO provider logo assets
- **Success URL** — optional redirect destination after successful configuration

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-admin-portal.guide.md`

## Related Skills

- workos-authkit-base — for authentication flows that feed into Admin Portal
- workos-sso — for understanding SSO configurations managed via Admin Portal
- workos-directory-sync — for Directory Sync setups initiated through Admin Portal
