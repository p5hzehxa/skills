# Spec: RBAC Hand-Crafted Skill

**Template**: ./spec-template-product-skill.md
**Contract**: ./contract.md
**Estimated Effort**: S

## Inputs

- Product: Role-Based Access Control
- File: `plugins/workos/skills/workos/references/workos-rbac.guide.md`
- Doc URLs: https://workos.com/docs/rbac/quick-start, https://workos.com/docs/rbac/organization-roles, https://workos.com/docs/rbac/integration, https://workos.com/docs/rbac/idp-role-assignment
- Eval cases: `scripts/eval/cases/rbac.yaml` (2 cases: permission check, role assignment)

## Product-Specific Content

### Primary Decision Tree (Step 3): "How to check authorization"

The eval showed Claude defaults to checking role slugs instead of permissions. This tree corrects that.

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

**Trap:** Claude consistently uses `role.slug === 'admin'` for access control. This breaks in multi-org setups where orgs have custom roles. Always prefer permission checks.

### Secondary Decision Tree: "Role scope"

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

### Primary Code Example (Step 4): Permission Check + Role Assignment

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

// 1. Get membership ID (NOT user ID — this is the trap)
memberships = workos.userManagement.listOrganizationMemberships({
  organizationId: org_id,
  userId: user_id
})
membership_id = memberships.data[0].id

// 2. Update role
workos.userManagement.updateOrganizationMembership(
  membership_id,
  { roleSlug: "billing-admin" }
)
```

### Step 5: IdP Role Assignment Trap

```
Using SSO or Directory Sync with role assignment?
  |
  +-- IdP group mapping enabled
  |     → IdP assignments OVERRIDE API/Dashboard assignments
  |     → On every auth/sync, role resets to IdP-mapped value
  |     → ONLY works with environment-level roles (not org roles)
  |     → If user is in multiple IdP groups → union of all mapped roles
  |
  +-- No IdP mapping
        → API and Dashboard assignments stick
        → User keeps assigned role until explicitly changed
```

**Trap:** If IdP mapping exists, calling `updateOrganizationMembership()` to change a role is silently overwritten on next auth. Claude doesn't warn about this.

### Error Recovery

1. **`"Role slug does not exist"`** — Role was deleted from Dashboard or using org role slug without `org:` prefix. Fix: list available roles with `workos.userManagement.listRoles()`. If role exists with `org:` prefix, use full slug.

2. **`"Permission denied"` despite correct role** — Three causes:
   - Stale session: user got new role after login → force re-authentication
   - Wrong org context: checking role from Org A while user is in Org B → pass `organizationId` to session lookup
   - Permission typo: `"video.create"` vs `"videos.create"` (plural) → copy exact slug from Dashboard

3. **Role assignment silently reverts** — IdP group mapping overrides API assignments on every auth. Fix: use environment-level roles for IdP mapping, or remove IdP group mapping and assign via API only.

### Verification Commands

```bash
# 1. Authorization checks exist in code
grep -r "permissions.includes\|role.permissions\|hasPermission" src/ || echo "FAIL: No permission checks"

# 2. Uses permission checks, not just slug checks
grep -r "role.slug" src/ | grep -v "test\|spec" | wc -l  # Should be fewer than permission checks

# 3. Role assignment uses membership ID (not user ID)
grep -r "updateOrganizationMembership\|OrganizationMembership" src/ || echo "WARN: No role assignment code"

# 4. Dashboard has roles configured
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles | grep -q "slug" && echo "✓ roles exist" || echo "✗ no roles configured"
```

## Deviations from Template

- Has TWO decision trees (auth check pattern + role scope) because these are independent decisions both commonly needed
- Code example shows BOTH permission checking AND role assignment (the two eval test cases)
- Step 5 focuses on IdP override trap rather than a second integration pattern
- Verification includes a comparison check (slug vs permission usage count) — more nuanced than pass/fail

## Validation

```bash
wc -c plugins/workos/skills/workos/references/workos-rbac.guide.md  # Target: 3000-5000 bytes
bun run eval -- --product=rbac --no-cache  # Target: delta > +9% (current avg)
```
