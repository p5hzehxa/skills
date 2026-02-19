---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use this API when you need direct programmatic control over authentication flows without using pre-built UI components. Choose this over AuthKit SDK integrations when building custom authentication experiences, CLIs, mobile apps, or server-to-server integrations. For standard web authentication with pre-built UI, use an AuthKit SDK integration skill instead.

## Key Concepts

**Authentication Flow Components**
- **Authorization URL** — OAuth-style redirect URL that initiates authentication (`/authentication/get-authorization-url`)
- **Code exchange** — trading authorization code for session tokens at `/authentication/code`
- **PKCE** — Proof Key for Code Exchange, required for public clients (mobile/CLI)
- **Redirect URI** — callback URL registered in WorkOS dashboard, must match exactly

**Session Management**
- **Access token** — short-lived JWT for API authorization (typically 5-15 min)
- **Refresh token** — long-lived token for obtaining new access tokens
- **Sealed session** — encrypted session data format for stateless storage
- **Session cookie** — HTTP-only cookie containing sealed session data

**User Identity**
- **User ID** — prefixed with `user_`, primary identifier
- **Email verification** — separate flow at `/email-verification` endpoints
- **Organization membership** — user-org relationship with role
- **External ID** — your system's user identifier, retrievable via `/user/get-by-external-id`

**Multi-Factor Authentication**
- **Authentication factor** — enrolled MFA method (TOTP, SMS)
- **Authentication challenge** — MFA verification step during sign-in
- **Enroll auth factor** — add new MFA method at `/mfa/enroll-auth-factor`

**Passwordless Authentication**
- **Magic Auth** — email-based authentication at `/magic-auth/create`
- **CLI Auth** — device flow for CLI tools: get device code at `/cli-auth/device-authorization`, poll at `/cli-auth/device-code`

**Invitations and Access Control**
- **Invitation token** — unique token for user signup/org access
- **Organization selection** — when user belongs to multiple orgs
- **SSO required** — enforced SSO policy blocks password auth

**API Keys** (for programmatic access)
- **Create for organization** — generate API keys scoped to org at `/api-keys/create-for-organization`
- **Validate** — verify API key and retrieve metadata at `/api-keys/validate`

**Session Helpers** (SDK utilities)
- **authenticate** — validate and decode session tokens
- **load sealed session** — decrypt sealed session data
- **refresh** — obtain new access token using refresh token

**Error Handling Patterns**
- Check error codes at `/authentication/get-authorization-url/error-codes` and `/cli-auth/error-codes`
- Handle specific error types: `email_verification_required`, `mfa_challenge`, `sso_required`, `organization_selection`
- Return 401 for invalid tokens, 403 for authorization failures

**Common Decision Points**
- Use Magic Auth for passwordless flows, password endpoints for traditional auth
- Use CLI Auth device flow for terminal applications, standard OAuth for web
- Implement PKCE for mobile/CLI clients, regular code flow for confidential server apps
- Use organization membership endpoints to manage user-org relationships and roles

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-authkit.guide.md`

## Related Skills

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
- workos-authkit-base
