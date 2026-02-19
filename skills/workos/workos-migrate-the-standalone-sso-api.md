---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: the standalone SSO API

## When to Use

Use this when you have an existing WorkOS SSO integration using the standalone SSO API (`POST /sso/authorize`, `GET /sso/profile`) and need to migrate to AuthKit. You are replacing direct SSO API calls with AuthKit's pre-built UI and session management, while preserving your existing SSO connections and user data.

## Documentation

- https://workos.com/docs/migrate/standalone-sso

## Key Concepts

### Two Systems to Distinguish
- **Standalone SSO API**: The old system using `/sso/authorize`, `/sso/profile`, and manual session management
- **AuthKit**: The new system with pre-built UI (`/auth`), automatic session management, and simplified integration

### Migration Approach
- **Connection preservation**: Existing SSO connections (identified by `connection_id`) continue to work unchanged — no re-configuration needed
- **Incremental migration path**: Run both systems in parallel during transition by routing users based on session type or feature flag
- **Session management shift**: Move from manual JWT/session handling to AuthKit's framework-specific SDK session management

### Key Architectural Changes
1. **Authorization flow**: Replace `POST /sso/authorize` redirect with AuthKit hosted UI at `/auth`
2. **Profile retrieval**: Replace `GET /sso/profile` with AuthKit's `getUser()` SDK method (exact name varies by framework)
3. **Callback handling**: Replace custom callback endpoint with AuthKit's automatic callback handling at `/auth/callback`

### ID Prefixes and Environment Variables
- Connection IDs: `conn_*` (unchanged between systems)
- Organization IDs: `org_*` (unchanged between systems)
- API Key: `WORKOS_API_KEY` (same key works for both systems)
- Client ID: `WORKOS_CLIENT_ID` (same ID works for both systems)
- Redirect URI: Changes from your custom callback URL to AuthKit's `/auth/callback` route

### Decision Tree: Which Migration Path?
1. **If you use WorkOS for authentication only** → migrate directly to AuthKit
2. **If you use standalone SSO API + other WorkOS products** → migrate SSO first, then integrate other products with AuthKit sessions
3. **If you have custom session logic** → decide whether to adopt AuthKit's session management or keep custom logic (mixing increases complexity)

### Framework-Specific Considerations
- Each AuthKit SDK (Next.js, React, vanilla JS) has different session management patterns
- Check your framework's AuthKit skill for exact SDK method names: workos-authkit-nextjs, workos-authkit-react, workos-authkit-vanilla-js
- Redirect URI configuration differs by framework — defer to framework-specific guide

### Common Traps
- **Do NOT change connection_id values** — existing connections are preserved as-is
- **Do NOT require users to re-authenticate** — sessions can be migrated or users redirected to new flow
- **Do NOT assume API response schemas are identical** — AuthKit returns different user object structure than `/sso/profile`
- **Do NOT try to use both /sso/authorize and /auth simultaneously for the same user** — pick one flow per user session

### Verification Command
```bash
# Confirm existing connections still work after migration
curl -X GET "https://api.workos.com/connections" \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data[] | {id, organization_id, state}'
```

Check fetched docs for:
- Exact user object schema differences between `/sso/profile` and AuthKit `getUser()`
- Framework-specific session migration strategies
- Whether your SSO provider requires any configuration changes (most do not)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-the-standalone-sso-api.guide.md`

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
