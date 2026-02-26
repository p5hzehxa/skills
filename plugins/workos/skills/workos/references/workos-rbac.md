<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to assign users to predefined roles with associated permissions, then enforce those permissions in your application. RBAC is appropriate when your authorization model fits hierarchical role structures (admin, editor, viewer) rather than relationship-based access control.

## Key Vocabulary

- **Role** `role_` — Named permission set assigned to users
- **Resource** `res_` — Protected entity in your application (e.g., documents, projects)
- **Permission** — Action that can be checked (e.g., `document:read`, `project:delete`)
- **Authorization Check** — Runtime verification of whether a user's roles grant a specific permission

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
