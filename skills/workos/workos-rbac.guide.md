<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

These are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Verify WorkOS SDK is installed before proceeding. Location varies by language (check fetched docs for package name).

**Verify:** SDK package exists in dependencies before continuing.

## Step 3: Configuration Strategy (Decision Tree)

```
Need custom roles per organization?
  |
  +-- YES --> Use Organization Roles (Step 4a)
  |           - Role slugs auto-prefixed with `org`
  |           - Each org gets independent default role & priority order
  |           - Configured via Dashboard > Organization > Roles tab
  |
  +-- NO  --> Use Environment Roles (Step 4b)
              - Shared across all organizations
              - Configured via Dashboard > Environment Settings
```

**Key difference:** Environment roles are global. Organization roles override environment roles for a specific org.

## Step 4a: Organization Roles (For Custom Per-Org Access)

### When to Use

- Organization needs permissions that don't match your default roles
- Organization requires lesser/greater privileges than standard users
- Organization wants to manage their own role definitions

### Configuration

In WorkOS Dashboard:
1. Navigate to organization > Roles tab
2. Create role — slug will auto-prefix with `org`
3. Assign permissions to the new role

**CRITICAL:** Once you create the FIRST organization role:
- That organization gets its own default role (independent from environment)
- That organization gets its own priority order (independent from environment)
- New environment roles will appear at BOTTOM of org's priority order

### Deleting Environment Roles

If an environment role is the default role for ANY organization:
- Dashboard will prompt you to select a replacement
- All affected org members are automatically reassigned to new default

**Trap:** You cannot delete an environment role that's in use as an org default without choosing a replacement first.

## Step 4b: Environment Roles (For Global Access)

Check fetched docs for environment role configuration. All organizations inherit these by default unless they have custom organization roles.

## Step 5: Role Assignment Integration (Decision Tree)

```
Where are roles assigned?
  |
  +-- IdP (Identity Provider)
  |     - SSO group mappings OR directory group mappings
  |     - HIGHEST PRECEDENCE - overrides API/Dashboard assignments
  |     - Updates on: auth event (SSO) or directory sync event
  |
  +-- API/Dashboard
        - Manual assignment via organization membership endpoints
        - Check fetched docs for SDK method signature
        - LOWER PRECEDENCE - overridden by IdP assignments
```

**Critical:** IdP role assignment ALWAYS wins. If a user has roles from IdP, manual assignments via API/Dashboard are ignored.

## Step 6: Single vs Multiple Roles (Decision Tree)

```
How many roles per user?
  |
  +-- Single role
  |     - Default behavior
  |     - User has one role per organization membership
  |
  +-- Multiple roles
        - User can have multiple roles per organization membership
        - Automatic if user is in multiple groups with role mappings
        - Applies to: directory users, SSO profiles, org memberships
        - Check fetched docs for "multiple roles" configuration
```

**Group-based assignment:** If user is member of 3 groups with role mappings, they receive ALL 3 roles.

## Step 7: Reading Roles in Your Application

### From Session (AuthKit Integration)

Check fetched docs for:
- How to extract role slugs from JWT
- How to extract permissions from JWT
- Session structure and claims

### From API (Non-AuthKit Integration)

Use SDK method for fetching organization membership — check fetched docs for exact signature.

Response includes:
- `role` or `roles` field (depending on single/multiple role config)
- Organization ID
- User ID

## Step 8: Access Control Implementation

### Pattern: Permission Checks

```
1. Extract permissions from session/API response
2. Check if required permission exists in user's permission set
3. Allow/deny based on presence of permission
```

**Do NOT check role slugs directly** — check permissions. Roles map to permissions, and permission sets are what matter for access control.

### Pattern: Role-Aware Routing

```
1. Extract role slug from session/API response
2. Map role slug to allowed routes/features
3. Redirect or 403 if role doesn't match
```

Use this pattern when your UI varies significantly by role (e.g., admin panel vs user dashboard).

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Verify roles are configured in Dashboard
# Manual: Navigate to Dashboard > Roles tab - at least one role should exist

# 3. Test role assignment (replace with your org/user IDs)
# Use SDK method to fetch organization membership
# Verify response includes role field

# 4. Test permission extraction from session
# Make authenticated request
# Verify session contains permissions array/object
```

## Error Recovery

### "Role not found" when assigning roles

**Root cause:** Role slug doesn't exist in environment OR organization.

Fix:
1. Check Dashboard > Roles tab for correct slug
2. For organization roles: check organization's Roles tab specifically
3. Verify slug prefix (`org` for organization roles, no prefix for environment roles)

### "Permission denied" despite correct role

**Root cause 1:** IdP assignment overriding manual assignment.

Fix: Check if user has SSO/Directory sync enabled. If yes, role MUST be assigned via IdP group mapping.

**Root cause 2:** Role doesn't include the required permission.

Fix: Check Dashboard > Roles > [Role Name] > Permissions. Add missing permission.

### Role changes not reflecting immediately

**For SSO group assignment:** Role updates on next authentication. User must log out and log back in.

**For directory group assignment:** Role updates on next directory sync event (automatic).

**For API/Dashboard assignment:** Role updates immediately, but session JWT won't reflect change until next token refresh.

**Fix:** Implement token refresh logic OR require re-authentication after role change.

### "Cannot delete role - in use as default"

**Root cause:** Role is the default role for one or more organizations.

Fix:
1. Dashboard will show replacement prompt
2. Select a new default role
3. All affected org members will be automatically reassigned

**Trap:** You must choose a replacement - no way to delete without reassigning users.

### Multiple roles not working

**Root cause:** Multiple role support not enabled.

Fix: Check fetched docs for "multiple roles" configuration flag. May require environment setting or SDK configuration.

## Related Skills

- workos-authkit-nextjs — For Next.js AuthKit integration with RBAC
- workos-authkit-react — For React AuthKit integration with RBAC
