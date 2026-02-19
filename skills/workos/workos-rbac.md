---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## When to Use

Use this skill when you need to control what users can do in your application based on their organizational roles. Reach for RBAC when you want to assign users broad, role-based permissions (e.g., "admin", "member", "billing") rather than resource-specific access rules. If you need granular, resource-level authorization (e.g., "can this user edit *this specific document*"), use Fine-Grained Authorization instead.

## Documentation

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment

## Key Concepts

### Role Structure
- **Role slug**: string identifier for a role (e.g., `"admin"`, `"member"`, `"billing"`)
- Roles are defined per-organization in the WorkOS Dashboard
- A user has exactly one role per organization (cannot have multiple roles simultaneously)

### Role Sources
1. **Manually assigned roles**: set via Dashboard or Admin Portal
2. **IdP-synced roles**: mapped from SAML assertions or SCIM groups during SSO
   - Configure mappings in Dashboard under SSO connection settings
   - IdP attribute name maps to WorkOS role slug

### User-Role Association
- Roles are returned in the `User` object after authentication
- Access `user.role` to get the role slug for authorization decisions
- Role is scoped to the organization context of the authentication

### Integration Pattern
- **Fetch user object** after authentication to get role
- **Check role slug** in your authorization logic (e.g., middleware, route guards)
- **Sync role changes** by re-fetching user object or handling webhook events

### Dashboard Configuration
- Navigate to **Organizations → [Org] → Members** to assign roles manually
- Navigate to **SSO Connections → [Connection] → Role Mapping** to configure IdP role mappings
- Define available roles under **Organizations → [Org] → Settings → Roles**

### Decision Tree: When to Use RBAC vs FGA
- Use RBAC when permissions are role-based and uniform across resources (e.g., "all admins can delete")
- Use FGA when permissions vary per resource (e.g., "Alice can edit document X but not document Y")
- You can combine both: use RBAC for broad capabilities, FGA for resource-specific grants

### Trap Warnings
- **Role changes don't invalidate sessions automatically** — if you change a user's role in the Dashboard, their existing session token still contains the old role. Either force re-authentication or use webhooks to detect role changes.
- **IdP role mappings are case-sensitive** — ensure your SAML attribute values match the exact role slugs you defined in WorkOS.
- **Users without a mapped role are assigned a default role** — configure the default role in Dashboard to avoid unintended permissions.

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-rbac.guide.md`

## Related Skills

- **workos-fga**: Fine-grained authorization
- **workos-sso**: SSO for authenticated access
