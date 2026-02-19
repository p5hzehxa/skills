---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to assign users to predefined roles (admin, member, viewer) within an organization and enforce permissions based on those roles. RBAC is the right choice when your authorization model maps to job functions or organizational hierarchy, not when you need resource-level permissions (use FGA instead).

## Documentation

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment

## Key Vocabulary

- **Organization** `org_` — the tenant container for roles and memberships
- **OrganizationMembership** `om_` — links a user to an organization with an assigned role
- **Role** `role_` — a named set of permissions (e.g., "admin", "member")
- **User** `user_` — the authenticated identity receiving role assignments
- **IdP role mapping** — automatic role assignment based on SAML/OIDC claims

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
