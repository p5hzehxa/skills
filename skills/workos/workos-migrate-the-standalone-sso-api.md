---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Migrate an existing WorkOS standalone SSO API integration to AuthKit. Use this skill when you have an app using WorkOS's SSO endpoints directly (authorize URL generation, profile retrieval) and want to adopt AuthKit's session management and authentication flow. This is a WorkOS-to-WorkOS migration, not a third-party provider migration.

## Documentation

- https://workos.com/docs/migrate/standalone-sso

## Key Vocabulary

- **Connection** `conn_` — SSO connection entity linking your organization to an identity provider
- **Organization** `org_` — tenant entity in WorkOS
- **Profile** — user identity data returned after authentication (becomes User object in AuthKit)
- **User** `user_` — AuthKit's representation of an authenticated user
- **Session** — AuthKit's encrypted session token (framework-specific implementation)
- **Authorization URL** — SSO login redirect endpoint (standalone SSO API construct)
- **Callback endpoint** — route that receives SSO authentication responses

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
