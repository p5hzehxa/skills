<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order:
- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Account Setup

Check Dashboard access:
- Navigate to https://dashboard.workos.com/
- Confirm API Key exists (Settings → API Keys)
- Confirm at least one environment exists

### Environment Variables

Check project for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_` (if using AuthKit)

### SDK Installation

Verify SDK package exists in project dependencies before writing code.

## Step 3: Role Configuration Strategy (Decision Tree)

```
Role architecture needs?
  |
  +-- Same roles for all orgs --> Configure environment-level roles only
  |                               (Dashboard → Roles & Permissions)
  |
  +-- Some orgs need custom roles --> Use organization-level roles
  |                                   (per-org in Dashboard → Organizations → [Org] → Roles)
  |
  +-- Mix of both --> Start with environment roles, add org roles as needed
```

**Key structural facts:**
- Environment roles: apply to all organizations by default
- Organization roles: slug automatically prefixed with `org_`
- Organization roles override environment roles when defined

## Step 4: Permission Model Design

Before configuring in Dashboard, map your app's resources to permissions:

**Pattern: `{resource}:{action}`**

Examples:
- `videos:view`, `videos:create`, `videos:delete`
- `settings:read`, `settings:write`
- `members:invite`, `members:remove`

**Decision point: Granular vs. grouped permissions**

```
Permission granularity?
  |
  +-- Fine-grained control needed --> One permission per action
  |   (e.g., separate `videos:edit`, `videos:delete`)
  |
  +-- Simplified role management --> Group related actions
      (e.g., single `videos:manage` permission)
```

## Step 5: Dashboard Configuration

### 5a: Environment Roles (if using)

Navigate: Dashboard → Roles & Permissions → Roles

Create roles with:
1. Slug (no prefix, e.g., `admin`, `member`, `viewer`)
2. Display name
3. Assigned permissions

**Set default role** - assigned automatically to new org memberships.

**Set priority order** - determines precedence for multi-role users.

### 5b: Organization Roles (if using)

Navigate: Dashboard → Organizations → [Select Org] → Roles

Click "Create role" to add org-specific role.

**Critical:** First org role created triggers independent default role and priority order for that org. New environment roles still appear but at bottom of org's priority order.

## Step 6: Integration Pattern Selection (Decision Tree)

```
How are you managing users?
  |
  +-- Using AuthKit --> Proceed to Step 7 (role assignment via memberships)
  |
  +-- Using SSO only --> Check docs for SSO profile role mapping
  |
  +-- Using Directory Sync only --> Check docs for directory user role mapping
  |
  +-- Custom user system --> Use RBAC API directly (Step 8)
```

## Step 7: AuthKit Role Assignment

### Assignment Methods (Priority Order)

**1. IdP Role Assignment (Highest Priority)**
- SSO groups → roles (updates on each auth)
- Directory groups → roles (updates on sync events)

**2. API Assignment**
Use SDK method for updating organization membership roles.

**3. Dashboard Assignment**
Navigate: Dashboard → Organizations → [Org] → Members → [Member] → Edit roles

**Trap warning:** IdP assignment ALWAYS overrides API/Dashboard. If roles keep reverting, check IdP group mappings.

### Single vs. Multiple Roles

Check fetched docs for multi-role configuration. Decision factors:
- Does user belong to multiple groups with role mappings? → They receive all roles
- Which role's permissions apply? → Union of all assigned role permissions

## Step 8: Access Checks in Application

### Server-Side Pattern (AuthKit)

**For protected routes:**
1. Extract session (JWT from cookie/header)
2. Read `role` or `roles` claim from session
3. Check role slug against required role for route

**For permission checks:**
1. Extract `permissions` claim from session JWT
2. Check if required permission exists in array
3. Allow/deny action based on result

Check fetched docs for exact JWT structure and SDK method for session validation.

### Direct API Pattern (Non-AuthKit)

Use SDK method for fetching organization membership, which includes assigned roles.

**Verification pattern:**
```
Request with user ID + org ID
  → Get membership object
  → Extract roles array
  → Check role slug(s) or permissions
  → Return authorization decision
```

## Step 9: Role Deletion Impact

**Environment role deletion:**
- If role is any org's default → You MUST select replacement default for affected orgs
- Members with deleted role → Automatically reassigned to new default

**Organization role deletion:**
- Only affects that org
- Members reassigned to org's default role

**Before deleting:** Run impact analysis in Dashboard to see affected memberships.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm setup:

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: API key missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Client ID missing (if using AuthKit)"

# 2. SDK package installed
npm list @workos-inc/node 2>/dev/null || echo "Check for SDK package"

# 3. Application builds
npm run build || yarn build

# 4. Type check passes (TypeScript projects)
npx tsc --noEmit || echo "Type errors - check SDK types imported"
```

**Manual Dashboard checks:**
1. Navigate to Roles & Permissions → At least one role exists
2. Navigate to Organizations → Select org → Members → At least one member has role assigned
3. If using IdP assignment: Organizations → [Org] → Directory/SSO → Group mappings configured

## Error Recovery

### "User has no roles assigned"

**Root cause:** Membership exists but no role assigned and no default role set.

**Fix:**
1. Check Dashboard → Roles & Permissions → Default role is set
2. If org-level roles exist: Check that org has default role set
3. Manually assign role via Dashboard or API

### "Role not found" / "Invalid role slug"

**Root cause:** Mismatch between code and Dashboard configuration.

**Fix:**
1. List all roles via SDK method for fetching roles
2. Compare slugs in code against fetched slugs
3. Remember: org role slugs have `org_` prefix, environment roles do not

### "Permissions not in session JWT"

**Root cause:** Session created before role/permission configuration, or session not refreshed.

**Fix:**
1. User must re-authenticate to get updated JWT
2. Check token expiry - old tokens don't have new permissions
3. Force re-auth by invalidating session

### "IdP assignment not working"

**Root cause:** Group mapping misconfigured or group sync not triggered.

**Fix:**
1. Dashboard → Organizations → [Org] → Directory/SSO → Verify group mappings exist
2. For Directory Sync: Trigger manual sync to force group update
3. For SSO: User must authenticate again to trigger group sync
4. Check fetched docs for group attribute name requirements (varies by IdP)

### "Multiple roles causing permission conflicts"

**Root cause:** Confusion about permission union vs. intersection.

**Fix:**
- Multi-role permissions are UNION (user has ALL permissions from ALL roles)
- If user shouldn't have permission, remove role assignment or modify role's permissions
- Check role priority order if conflicts exist (though union model means this rarely matters)

## Related Skills

- workos-authkit-nextjs - Integrate RBAC with Next.js AuthKit implementation
- workos-authkit-react - Integrate RBAC with React AuthKit implementation
