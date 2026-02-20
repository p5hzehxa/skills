<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

Use this skill when you need to generate secure, time-limited links for organization admins to configure SSO, Directory Sync, or other WorkOS features through a pre-built UI. The Admin Portal eliminates the need to build custom configuration interfaces for enterprise authentication setups.

## Key Vocabulary

- **Portal Link** — time-limited URL (`https://id.workos.com/portal/launch?token=...`) that grants admin access
- **Organization `org_`** — the entity whose admins will configure features through the portal
- **Intent** — the portal type/feature to configure: `sso`, `dsync`, `log_streams`, `audit_logs`
- **Provider Icons** — endpoint returns URLs for identity provider logos (e.g., Okta, Azure AD)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-admin-portal.guide.md`
