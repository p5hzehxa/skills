<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### API Keys

Check environment variables:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - client identifier (if using AuthKit integration)

### SDK Installation

Verify SDK package exists in project dependencies. Check fetched docs for latest package name and version compatibility.

## Step 3: Dashboard Configuration (Decision Tree)

```
Role scope decision?
  |
  +-- Same roles for all orgs --> Configure environment-level roles in Dashboard
  |                                (Roles tab at environment level)
  |
  +-- Custom roles per org     --> Configure organization-level roles
                                   (Roles tab under specific organization)
```

**Environment-level roles:**

- Default for all organizations
- Slug naming: no automatic prefix
- Inherited by new organizations

**Organization-level roles:**

- Override environment defaults for specific org
- Slug naming: automatically prefixed with `org_`
- Isolated from other organizations

**CRITICAL:** First organization role creation triggers separate default role + priority order for that org.

### Role Configuration Components

Configure via Dashboard (check fetched docs for API equivalents):

1. **Role slug** - immutable identifier used in code
2. **Role name** - display name for UI
3. **Permissions** - resource/action pairs (e.g., `videos.create`, `settings.manage`)
4. **Default role** - auto-assigned to new org members
5. **Priority order** - conflict resolution when user has multiple roles

## Step 4: Integration Pattern Selection (Decision Tree)

```
Which WorkOS product are you using?
  |
  +-- AuthKit                --> Roles in org membership + session JWTs
  |                              (See: workos-authkit-* skills)
  |
  +-- SSO only               --> Roles via IdP groups or API assignment
  |                              Check fetched docs for SSO group mapping
  |
  +-- Directory Sync only    --> Roles via directory groups or API assignment
  |                              Check fetched docs for directory group mapping
  |
  +-- Standalone             --> Roles via API assignment only
                                 Use Organization Membership API directly
```

## Step 5: Role Assignment Implementation

### AuthKit Integration (Most Common)

Organization memberships link users to orgs with roles. Check fetched docs for exact SDK method signatures.

**Assignment methods (priority order):**

1. **IdP role assignment** (highest priority)
   - SSO group mappings → roles on each auth
   - Directory group mappings → roles on sync events
   - Overrides API/Dashboard assignments

2. **API assignment**
   - Use SDK method for updating org membership roles
   - Check fetched docs for role update method signature

3. **Dashboard assignment**
   - Manual via organization's Members tab

4. **Default role** (fallback)
   - Assigned when no explicit role set

**TRAP:** IdP assignments ALWAYS override API/Dashboard. If IdP mapping exists, API changes will be overwritten on next sync/auth.

### Single vs. Multiple Roles

Check fetched docs for:

- How to enable multiple role mode
- Role precedence rules when user has multiple roles
- Permission aggregation behavior (union vs. intersection)

**Common pattern:** User in multiple IdP groups → receives all mapped roles → permissions are union of all role permissions.

## Step 6: Access Control Checks

Implement authorization checks using role slugs and permission keys configured in Step 3.

**Language-agnostic pattern (check fetched docs for exact SDK syntax):**

```
// Fetch user's current role for organization
userRole = workos.userManagement.getOrganizationMembership(userId, organizationId).role

// Check permission
if (userRole.permissions.includes('videos.create')) {
  // Allow video creation
}

// Or check role directly
if (userRole.slug === 'admin' || userRole.slug === 'manager') {
  // Allow settings access
}
```

**CRITICAL:** Always check permissions in the context of a specific organization. Same user may have different roles in different orgs.

### Session-Based Checks (AuthKit)

For AuthKit integrations, roles and permissions are available in session JWTs. Check fetched docs for:

- JWT claim structure for roles/permissions
- How to extract role data from session token
- Token refresh behavior when roles change

## Step 7: Organization Role Management

### When to Use Organization Roles

Use organization-level roles when:

- Customer needs custom permission set not in environment roles
- Different orgs need different role hierarchies
- Compliance requires org-specific access controls

### Creation Pattern

1. Navigate to organization's Roles tab in Dashboard
2. Click "Create role" (first role triggers separate config for org)
3. Define slug (auto-prefixed with `org_`), name, permissions
4. Set new default role and priority order for org

**TRAP:** After creating first org role, new environment roles are added to org's priority order at BOTTOM. Manually reorder if needed.

### Deletion Handling

Deleting environment role that's a default for orgs:

- Dashboard prompts for replacement default role
- All affected org members reassigned to new default
- Organization-specific roles unaffected

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment variables
env | grep WORKOS_API_KEY || echo "FAIL: API key not set"

# 2. Verify SDK installed
npm list | grep workos || echo "FAIL: SDK not installed"

# 3. Test API connectivity (replace with actual SDK health check)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organizations | \
  grep -q "data" && echo "PASS: API reachable" || echo "FAIL: API unreachable"

# 4. Verify Dashboard config
echo "MANUAL: Confirm at least one role exists in Dashboard Roles tab"
```

**Critical verification:**

- At least one role configured in Dashboard
- Default role is set for environment or org
- Permission keys match what code checks for

## Error Recovery

### "Role not found" during assignment

**Root cause:** Role slug mismatch between code and Dashboard.

Fix:

1. Check Dashboard Roles tab for exact slug
2. For org roles, verify `org_` prefix is included in code
3. Confirm role exists at correct scope (environment vs. organization)

### "Permission denied" despite correct role

**Root cause:** Permission key mismatch or role doesn't include permission.

Fix:

1. Check Dashboard role configuration for exact permission keys
2. Verify permission format: `{resource}.{action}` (e.g., `videos.create`)
3. For multiple roles, confirm permission union includes required permission

### IdP role assignment not applying

**Root cause:** Group mapping not configured or user not in IdP group.

Fix:

1. Check fetched docs for IdP group mapping configuration
2. Verify user's group membership in IdP
3. For SSO: trigger re-authentication to sync roles
4. For Directory Sync: check directory sync status and recent events

### Organization role changes not reflecting

**Root cause:** Session not refreshed or caching issue.

Fix:

1. For AuthKit: user must re-authenticate to get new JWT
2. Check JWT expiration time and refresh token behavior
3. Verify API calls fetch fresh organization membership data

### Environment role updates not in organization

**Root cause:** Organization has custom role configuration.

Fix:

1. Check if org has any org-specific roles (Roles tab under organization)
2. New environment roles are added to org's priority order automatically
3. Manually adjust org's priority order if new role needs higher precedence

## Related Skills

- workos-authkit-nextjs - Full AuthKit integration with session-based role checks
- workos-authkit-react - Client-side auth with role-aware UI rendering
