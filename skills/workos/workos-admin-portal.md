---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## When to Use

Use Admin Portal when you need to give customers a self-service UI for managing SSO connections, Directory Sync, or other WorkOS integrations. It eliminates the need to build your own configuration screens—customers access a hosted portal to set up their integrations without involving your support team.

## Key Vocabulary

- **Organization** `org_` — the customer entity that owns connections
- **Portal Link** — time-limited URL (`https://id.workos.com/portal/launch?token=...`) that grants access to the portal
- **Intent** — the feature a customer can configure (`sso`, `dsync`, `audit_logs`, `log_streams`)
- **Success URL** — where WorkOS redirects the customer after completing portal actions
- **Return URL** — optional URL to return customers mid-session (e.g., "Back to Dashboard")
- **WORKOS_API_KEY** — server-side credential for generating portal links

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-admin-portal.guide.md`

## Related Skills

- **workos-sso**: SSO configuration via portal
- **workos-directory-sync**: Directory setup via portal
- **workos-widgets**: Embeddable UI components
