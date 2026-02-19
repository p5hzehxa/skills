---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to assign users predefined roles (like "admin", "member", "viewer") within organizations and check those assignments at runtime. This is for coarse-grained permissions tied to organization membership — if you need attribute-based or resource-level access control, use Fine-Grained Authorization instead.

## Key Vocabulary

- **Role** — a named set of permissions (e.g., "admin", "member") defined in the WorkOS dashboard
- **Organization** `org_` — the tenant context where roles are assigned
- **User** `user_` — the identity receiving role assignments
- **Authorization object** — the JWT payload shape returned after checking a user's role
- **`listRoles()`** — SDK method to fetch all roles defined for an organization
- **Dashboard → Roles** — where you define custom roles and default assignments
- **Role slugs** — the canonical identifier for roles in API calls (e.g., `"admin"`, `"billing-manager"`)
- **IdP role mapping** — automatic role assignment based on SAML/OIDC attributes from identity providers

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
