<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use this reference when you need to implement low-level authentication flows, manage users/sessions directly via REST/SDK calls, or integrate AuthKit into a custom framework. If you're using React, Next.js, or vanilla JS, prefer the framework-specific AuthKit skills instead — they provide pre-built session management and UI components.

## Key Vocabulary

- **User `user_`** — end-user identity object with email, profile, and authentication metadata
- **Session `session_`** — authenticated session with access/refresh tokens
- **Invitation `invitation_`** — organization invitation with token-based acceptance flow
- **OrganizationMembership `organization_membership_`** — links a user to an organization with role
- **AuthenticationFactor `auth_factor_`** — MFA enrollment record (TOTP, SMS)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-authkit.guide.md`

## Related Skills

- `workos-authkit-react` — React integration with hooks and components
- `workos-authkit-nextjs` — Next.js App Router integration with middleware
- `workos-authkit-vanilla-js` — Framework-agnostic browser integration
- `workos-authkit-base` — Core concepts shared across all AuthKit implementations
