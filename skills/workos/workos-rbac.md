---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to assign fixed roles to users within organizations and enforce permissions based on those roles. RBAC is appropriate when your access control model is hierarchical (e.g., "admin", "member", "viewer") and permissions are tied to role membership rather than resource-specific relationships.

## Documentation

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment

## Key Vocabulary

- **Organization** `org_` — tenant entity that contains users and roles
- **Role** — named permission set (e.g., "admin", "member") assigned to users
- **User** `user_` — authenticated entity with role assignments
- **OrganizationMembership** `org_membership_` — links a user to an organization with a role
- **Permission** — granular capability checked in authorization logic
- **IdP Role Mapping** — automatic role assignment from SAML/OIDC claims

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
