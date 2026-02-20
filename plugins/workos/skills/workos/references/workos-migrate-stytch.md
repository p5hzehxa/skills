<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Use this skill when migrating an existing authentication system from Stytch to WorkOS. This guide covers user and organization data export, password hash migration, and SSO connection transfer. Choose this over generic migration when you have Stytch-specific export formats and need to preserve existing user credentials.

## Key Vocabulary

- **Organization** `org_` — WorkOS tenant container for users and SSO connections
- **User** `user_` — WorkOS identity record migrated from Stytch user objects
- **Connection** `conn_` — SSO configuration migrated from Stytch's SAML/OIDC setup
- **Password Hash** — bcrypt digest exported from Stytch, imported to WorkOS via User Management API
- **Stytch Export Format** — JSON structure containing `user_id`, `email`, `password_hash`, and organization metadata

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-stytch.guide.md`
