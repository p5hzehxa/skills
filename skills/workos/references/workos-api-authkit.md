<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## When to Use

Use this skill when you need direct HTTP API access to WorkOS AuthKit endpoints — user authentication, session management, MFA enrollment, organization memberships, invitations, and password resets. Prefer framework-specific skills (workos-authkit-react, workos-authkit-nextjs) for frontend flows; use this for backend services, CLI tools, or non-JavaScript environments.

## Key Vocabulary

- **User** `user_` — authenticated identity with email, password, and profile data
- **Session** `session_` — active authentication session with access/refresh tokens
- **Invitation** `invitation_` — pending invite to join an organization
- **OrganizationMembership** `org_membership_` — user's role and status within an organization
- **AuthenticationFactor** `auth_factor_` — enrolled MFA method (TOTP, SMS)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-authkit.guide.md`

## Related Skills

- **workos-authkit-react** — React hooks and components for AuthKit flows
- **workos-authkit-nextjs** — Next.js App Router integration with server actions
- **workos-authkit-vanilla-js** — Framework-agnostic browser JavaScript integration
- **workos-authkit-base** — Core authentication concepts shared across all AuthKit skills
