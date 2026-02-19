---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Use this skill when migrating user accounts and organization structures from Stytch to WorkOS. This guide covers exporting user data from Stytch's API, mapping Stytch's organization/member model to WorkOS's equivalent structures, and handling authentication state transitions.

## Documentation

- https://workos.com/docs/migrate/stytch

## Key Vocabulary

- **User** — Stytch user account (maps to WorkOS User)
- **Organization** — Stytch organization entity (maps to WorkOS Organization `org_`)
- **Member** — Stytch org membership (maps to WorkOS OrganizationMembership `om_`)
- **Magic Links** — Stytch passwordless auth method
- **Sessions** — Stytch session tokens (require re-authentication after migration)
- **MFA** — Stytch multi-factor enrollment (not directly portable)
- **`STYTCH_PROJECT_ID`** — Stytch project identifier for API calls
- **`STYTCH_SECRET`** — Stytch API credential for data export

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-stytch.guide.md`
