<!-- refined:sha256:cd9b112c355b -->

# WorkOS Admin Portal API Reference

## When to Use

Use the Admin Portal API when you need to generate portal links programmatically for end-user organizations to configure SSO, Directory Sync, or other WorkOS integrations. This is a routing reference — it helps you decide which endpoint to call (`/portal-link/generate` for link creation, `/provider-icons` for UI branding).

## Key Vocabulary

- **Organization** `org_` — the entity whose admins will access the portal
- **Portal Link** — time-limited URL for organization admins to configure WorkOS features
- **Intent** — specifies which portal module to open (e.g., `sso`, `dsync`, `log_streams`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-admin-portal.guide.md`

## Related Skills

- **workos-sso** — SSO configuration is a common portal intent
- **workos-directory-sync** — Directory Sync configuration is a common portal intent
