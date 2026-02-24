<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - required if using AuthKit integration

### SDK Installation

Verify SDK package exists in dependency list before writing code.

## Step 3: Role Architecture Decision Tree

Determine role scope for your application:

```
How should roles be scoped?
  |
  +-- Same roles for all organizations
  |   → Use environment-level roles (Dashboard → Roles)
  |   → Role slugs: "admin", "member", "viewer"
  |
  +-- Custom roles per organization
      → Use organization-level roles (Dashboard → Org → Roles tab)
      → Role slugs auto-prefixed: "org:custom_admin"
      → Each org gets independent default role + priority order
```

**Critical:** Once you create the FIRST organization role for an org, that org inherits NO environment roles. It gets its own isolated role system. This is irreversible through the UI.

## Step 4: Configure Roles in Dashboard

### Environment-Level Roles (Shared Across Orgs)

Dashboard → Roles → Create Role

Define:
- **Slug** (code reference): `admin`, `billing_manager`
- **Permissions** (check boxes): `videos.create`, `settings.manage`
- **Default role** (one per environment): assigned to new org members
- **Priority order** (drag to reorder): determines conflict resolution

### Organization-Level Roles (Custom Per Org)

Dashboard → Organizations → [Org Name] → Roles tab → Create Role

**First role triggers isolation:**
- Org stops inheriting environment roles
- Org gets its own default role setting
- Org gets its own priority order

Slug format: `org:custom_viewer` (prefix automatic)

Check fetched docs for complete role configuration options.

## Step 5: Assign Roles to Users

Get organization membership ID, then assign role:

```
workos.userManagement.updateOrganizationMembership(
  membershipId,
  { roleSlug: "admin" }
)
```

**Trap:** Role assignment requires membership ID, not user ID. Fetch memberships first via `workos.userManagement.listOrganizationMemberships(organizationId)`.

## Step 6: Authorization Checks (Implementation)

```
// Get user's role in current org context
session = workos.userManagement.authenticateWithCode(code)
role = session.organizationMembership.role

// Check permission
if (role.permissions.includes("videos.create")) {
  // allow action
}

// Check role slug
if (role.slug === "admin") {
  // allow admin-only action
}
```

**Decision: Permission vs Role Checks**

```
What should the check verify?
  |
  +-- Specific capability
  |   → Check permissions array: role.permissions.includes("videos.delete")
  |   → More flexible: survives role refactoring
  |
  +-- Exact role
      → Check slug: role.slug === "owner"
      → Brittle: breaks if org adds custom roles
```

**Best practice:** Prefer permission checks. Reserve slug checks for UI rendering (show/hide admin menu).

## Step 7: IdP Role Mapping (Optional)

If using SSO/Directory Sync, map IdP groups → WorkOS roles:

Dashboard → Connections → [Connection] → Role Assignment

**Mapping types:**
- **Automatic:** IdP group name matches WorkOS role slug exactly
- **Manual:** Map "Okta Admins" group → "admin" role slug

**Trap:** IdP role assignment ONLY works with environment-level roles. Organization-level roles cannot be assigned from IdP — use API to assign them post-provisioning.

Check fetched docs for IdP-specific mapping configuration.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check roles configured (environment OR org-level)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles | grep -q "slug" && echo "✓ roles exist" || echo "✗ no roles"

# 2. Check SDK installed
grep -i "workos" package.json || echo "FAIL: SDK not installed"

# 3. Check authorization logic exists
grep -r "role.permissions\|role.slug" src/ || echo "FAIL: No auth checks found"

# 4. Test role assignment (replace IDs)
curl -X PUT -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"role_slug":"admin"}' \
  https://api.workos.com/user_management/organization_memberships/{membership_id}
```

**If check #1 fails:** Configure roles in Dashboard before writing code.
**If check #3 fails:** Add permission checks to protected routes/actions.

## Error Recovery

### "Role slug does not exist"

**Cause:** Role deleted from Dashboard OR using org role slug in environment-only context.

**Fix:**
1. List available roles: `workos.userManagement.listRoles(organizationId)` (omit orgId for environment roles)
2. If role exists but prefixed with `org:`, you're in org-specific mode — use full slug
3. If role missing, recreate in Dashboard

### "Organization has no roles configured"

**Cause:** Attempting org-role operations before creating first org role.

**Fix:** Create first role in Dashboard → Org → Roles tab. This initializes org-specific role system.

### "Permission denied despite correct role"

**Root cause breakdown:**

```
Why is permission check failing?
  |
  +-- Stale session
  |   → User was assigned new role AFTER login
  |   → Fix: Force re-authentication to refresh role data
  |
  +-- Wrong organization context
  |   → Checking role.permissions from Org A while user is in Org B
  |   → Fix: Pass organizationId to session lookup
  |
  +-- Permission typo
      → "video.create" vs "videos.create" (plural)
      → Fix: Copy exact slug from Dashboard → Roles → [Role] → Permissions list
```

### "IdP group not mapping to role"

**Cause:** Using org-level roles with IdP assignment (unsupported).

**Fix:** Use environment-level roles for IdP mapping, or assign org roles via API after user provisioning.

## Related Skills

- workos-authkit-nextjs — for session management with RBAC
- workos-authkit-react — for client-side role-based UI rendering
