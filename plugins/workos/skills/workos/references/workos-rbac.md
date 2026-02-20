<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to assign users to predefined roles (Admin, Member, Viewer) and enforce permission checks based on those roles. This is simpler than Fine-Grained Authorization (FGA) but less flexible — choose RBAC when your authorization model fits a small set of stable roles rather than complex resource-specific permissions.

## Key Vocabulary

- **Role** `role_` — A named set of permissions (e.g., "Admin", "Member")
- **Resource** `resource_` — An entity users can access (e.g., Project, Repository)
- **Authorization** `authz_` — A user-role-resource binding
- **Permission** — A capability granted by a role (e.g., `repo:delete`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
