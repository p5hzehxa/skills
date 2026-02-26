<!-- hand-crafted -->

# WorkOS Role-Based Access Control — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/idp-role-assignment

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ missing WORKOS_API_KEY"
```

Also verify `WORKOS_CLIENT_ID` starts with `client_` if using AuthKit.

## Step 3: How to Check Authorization

```
What should your authorization check verify?
  |
  +-- "Can this user DO this action?" (capability check)
  |     → Check permissions: role.permissions.includes('videos.create')
  |     → Survives role refactoring (add/remove roles without code changes)
  |     → RECOMMENDED for all access control gates
  |
  +-- "IS this user an admin?" (identity check)
        → Check slug: role.slug === 'admin'
        → Brittle: breaks when org adds custom roles
        → Only use for: show/hide admin UI, audit log attribution
```

**Trap:** Claude defaults to `role.slug === 'admin'` for access control. Breaks in multi-org with custom roles. Always prefer permission checks.

### Role Scope Decision

```
Same roles for all organizations?
  |
  +-- Yes → Environment-level roles (Dashboard → Roles)
  |     → Slugs: "admin", "member", "viewer"
  |     → Inherited by all orgs
  |
  +-- No → Organization-level roles (Dashboard → Org → Roles)
        → Slugs auto-prefixed: "org:custom_admin"
        → TRAP: First org role creation isolates that org permanently
        → That org stops inheriting environment role changes
```

## Step 4: Permission Check + Role Assignment

```
// === Authorization Check (in route handler / middleware) ===

// Get user's session (via AuthKit or API)
session = get_authenticated_session(request)
user_role = session.organizationMembership.role

// Check permission (PREFERRED over slug check)
if (!user_role.permissions.includes('videos.create')) {
  return error(403, "Insufficient permissions")
}

// === Role Assignment (admin action) ===

// 1. Get membership ID (NOT user ID)
memberships = workos.userManagement.listOrganizationMemberships({
  organizationId: org_id,
  userId: user_id
})
membership_id = memberships.data[0].id

// 2. Update role via membership
workos.userManagement.updateOrganizationMembership(
  membership_id,
  { roleSlug: "billing-admin" }
)
```

**Trap:** Role assignment requires **membership ID**, not user ID. Fetch via `listOrganizationMemberships()` first.

## Step 5: IdP Role Assignment Trap

```
Using SSO or Directory Sync with roles?
  |
  +-- IdP group mapping enabled
  |     → IdP OVERRIDES API/Dashboard assignments on every auth
  |     → ONLY works with environment-level roles (not org roles)
  |     → Multiple IdP groups → union of mapped roles
  |
  +-- No IdP mapping
        → API and Dashboard assignments persist
```

**Trap:** `updateOrganizationMembership()` role changes silently revert on next auth if IdP mapping exists. Remove mapping or manage roles via IdP groups only.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Permission checks exist
grep -r "permissions.includes\|role.permissions" src/ || echo "FAIL: No permission checks"

# 2. Permission checks outnumber slug checks
echo "permissions: $(grep -rc 'role.permissions' src/ 2>/dev/null | grep -v test | wc -l)"
echo "slugs: $(grep -rc 'role.slug' src/ 2>/dev/null | grep -v test | wc -l)"

# 3. Role assignment uses membership ID
grep -r "updateOrganizationMembership" src/ || echo "WARN: No role assignment code"

# 4. Roles configured in Dashboard
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles | grep -q "slug" && echo "✓ roles exist" || echo "✗ no roles"
```

## Error Recovery

### "Role slug does not exist"

**Cause:** Role deleted from Dashboard, or using org role slug without `org:` prefix.
**Fix:**

1. List roles: `workos.userManagement.listRoles()` (omit `organizationId` for environment roles)
2. If role has `org:` prefix, use full slug
3. If missing, recreate in Dashboard → Roles

### "Permission denied" despite correct role

**Fix:**

1. **Stale session** — role assigned after login → force re-authentication
2. **Wrong org context** — role from Org A, user in Org B → pass `organizationId` to session
3. **Permission typo** — `"video.create"` vs `"videos.create"` → copy exact slug from Dashboard

### Role assignment silently reverts

**Cause:** IdP group mapping overrides API assignments on every auth.
**Fix:**

1. Check Dashboard → Connections → Role Assignment for active mappings
2. Remove IdP mapping and manage via API, or manage exclusively through IdP groups
