---
name: workos-rbac
description: Set up role-based access control for your application.
---

<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order. The docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

```bash
# Verify API key exists and has correct prefix
grep -q "WORKOS_API_KEY=sk_" .env* || echo "FAIL: WORKOS_API_KEY missing or wrong prefix"

# Verify client ID exists (if using AuthKit integration)
grep -q "WORKOS_CLIENT_ID=client_" .env* || echo "WARN: WORKOS_CLIENT_ID missing (required for AuthKit)"
```

### WorkOS Dashboard Access

Confirm you can access:
- Dashboard at https://dashboard.workos.com/
- Navigate to Roles & Permissions section
- You have admin permissions to modify RBAC config

## Step 3: Role Architecture Design (Decision Tree)

```
Authorization model?
  |
  +-- Environment-level only
  |     (Same roles across all organizations)
  |     --> Use environment roles (simpler, less maintenance)
  |
  +-- Per-organization customization needed
  |     (Customers need custom roles)
  |     --> Use organization roles (org_* prefix)
  |
  +-- Hybrid model
        (Base roles + org overrides)
        --> Start with environment roles, add org roles selectively
```

**Key concept:** Organization roles automatically inherit environment roles unless you create custom org roles. First org role created triggers independent org-level configuration.

## Step 4: Configure Roles in Dashboard

### 4a. Define Permissions

Navigate to Dashboard → Roles & Permissions → Permissions tab.

Pattern: Use resource-action naming (`videos.create`, `users.manage`, `settings.write`)

**Trap:** Permission names are case-sensitive. Standardize on lowercase with dots.

### 4b. Create Environment Roles

Dashboard → Roles & Permissions → Roles tab → Create Role

Each role needs:
- **Slug**: lowercase-hyphenated (e.g., `video-editor`, `admin`)
- **Name**: Human-readable display name
- **Description**: Shown in UI and dashboard
- **Permissions**: Select from previously defined permissions

**Critical:** Role slugs are immutable after creation. Plan slug naming carefully.

### 4c. Set Default Role

One role must be marked as default. This role is auto-assigned to new organization members.

**Trap:** Changing the default role does NOT retroactively reassign existing members.

### 4d. Configure Priority Order (Multiple Roles Only)

If using multiple roles per user, drag roles to set precedence for UI display.

**Decision point:** Single vs. multiple roles?
- Single role: Simpler RBAC logic, easier to reason about
- Multiple roles: More flexible, required for group-based IdP assignment

Check fetched docs for multiple role implications on session structure.

## Step 5: Organization Role Customization (Optional)

**Only if you need per-org role customization.**

Navigate to Dashboard → Organizations → [Select Org] → Roles tab.

### Creating Org-Specific Roles

Click "Create role" → Role slug automatically prefixed with `org_`

**Critical effect:** Creating the FIRST org role triggers:
- Organization gets its own default role setting (independent from environment)
- Organization gets its own priority order
- New environment roles still available but placed at bottom of org priority

**Trap:** You cannot "undo" org role mode once enabled. The org maintains independent config even if you delete all org roles.

### Deleting Environment Roles Used by Orgs

Dashboard will prompt for replacement role selection. All org members with deleted role are auto-reassigned.

**Verify:** Check affected orgs after deletion to confirm new role assignment.

## Step 6: Install SDK

Detect language from project structure, install WorkOS SDK:

```bash
# Node.js
npm install @workos-inc/node
# or
yarn add @workos-inc/node

# Python
pip install workos

# Ruby
gem install workos

# Go
go get -u github.com/workos/workos-go/v4

# Java
# Add to pom.xml or build.gradle - check docs for exact artifact
```

**Verify:** SDK package exists before writing integration code.

## Step 7: Role Assignment Integration (Decision Tree)

```
How are roles assigned?
  |
  +-- Manual (API/Dashboard)
  |     --> Use Organization Membership API
  |     --> UPDATE requests to modify roles
  |
  +-- IdP group mapping (SSO)
  |     --> Configure group→role mappings in Dashboard
  |     --> Roles update on each SSO login
  |     --> IdP assignment takes PRECEDENCE over manual
  |
  +-- Directory group mapping (provisioning)
  |     --> Configure group→role mappings in Dashboard
  |     --> Roles update on directory sync events
  |     --> IdP assignment takes PRECEDENCE over manual
  |
  +-- JIT provisioning (SSO or Directory)
        --> Combined with group mappings
        --> Users auto-created with group-derived roles
```

**Critical:** IdP-assigned roles ALWAYS override API/Dashboard assignments. If a user has IdP roles, manual changes will be overwritten on next sync/login.

### Manual Assignment Pattern

Use SDK method for updating organization membership roles. Check fetched docs for exact method signature and parameters.

Pseudocode:
```
membership = get_organization_membership(membership_id)
membership.update_role_slug(new_role_slug)
// or for multiple roles:
membership.update_role_slugs([role_slug_1, role_slug_2])
```

### IdP Assignment Setup

Dashboard → Organizations → [Select Org] → SSO/Directory → Role Mappings

Map IdP groups to role slugs:
- IdP Group Name → WorkOS Role Slug
- One group can map to multiple roles
- Multiple groups → user receives ALL mapped roles (union)

**Trap:** Group names must match EXACTLY (case-sensitive). Verify group names in IdP before mapping.

## Step 8: Access Control Implementation

### 8a. Retrieve User Roles

**Integration path depends on auth setup:**

```
User authenticated via?
  |
  +-- AuthKit
  |     --> Read roles from session JWT claims
  |     --> Check fetched docs for exact claim structure
  |
  +-- Custom auth (non-AuthKit)
        --> Query organization membership API
        --> Cache role data (roles change infrequently)
```

### 8b. Permission Checking Pattern

Pseudocode for permission checks:

```
function hasPermission(user, required_permission):
  user_roles = get_user_roles(user.org_membership_id)
  
  for role in user_roles:
    role_permissions = get_role_permissions(role.slug)
    if required_permission in role_permissions:
      return true
  
  return false
```

**Trap:** Do NOT cache permission checks across role changes. Cache role→permission mappings, not user→permission results.

### 8c. Middleware Integration

Implement access control middleware:

```
Protect route/endpoint?
  |
  +-- Yes → Add permission check before handler
  |   |
  |   +-- Permission granted → Continue to handler
  |   |
  |   +-- Permission denied → Return 403 Forbidden
  |
  +-- No → Public route, skip check
```

**Pattern for route protection:**

```
@require_permission("videos.create")
def create_video_handler(request):
  # Handler only runs if permission check passes
  # 403 returned automatically if denied
```

## Step 9: Multiple Roles Handling (If Enabled)

Check fetched docs for session structure with multiple roles.

**Key patterns:**

- **Role precedence:** Use priority order from dashboard for UI display (e.g., show highest priority role as "primary")
- **Permission union:** User has permission if ANY assigned role grants it
- **Role listing:** Sessions contain array of role slugs, not single slug

**Trap:** UI code assuming single role will break. Always handle role data as array even if typically one role.

## Step 10: Testing Strategy

### Test Coverage Required

1. **Default role assignment**: Create new org member → verify default role assigned
2. **Manual role updates**: Change member role via API → verify new permissions
3. **Permission denial**: Request protected resource without permission → verify 403
4. **Permission grant**: Request with correct role → verify 200
5. **Multiple roles** (if enabled): User with multiple roles → verify permission union

### Test Commands

```bash
# List all configured roles
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles

# Get organization membership with roles
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organization_memberships/{membership_id}

# Verify role has expected permissions
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles/{role_slug}
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment variables configured
grep -q "WORKOS_API_KEY=sk_" .env* && echo "PASS" || echo "FAIL"

# 2. SDK installed
ls node_modules/@workos-inc/node 2>/dev/null || \
python -c "import workos" 2>/dev/null || \
ruby -e "require 'workos'" 2>/dev/null || \
echo "Check SDK installation manually"

# 3. Roles defined (API check)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/roles | \
  grep -q '"object":"role"' && echo "PASS: Roles configured" || echo "FAIL: No roles found"

# 4. Protected routes return 403 without permission
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin | \
  grep -q "403" && echo "PASS" || echo "FAIL: Route not protected"

# 5. Application builds
npm run build || python -m py_compile app.py || echo "Check build manually"
```

**Do NOT mark complete until all checks pass.**

## Error Recovery

### "Invalid role slug" on assignment

**Root cause:** Role slug doesn't exist in environment or organization.

**Fix:**
1. List all roles via API or Dashboard
2. Verify slug matches exactly (case-sensitive)
3. For org roles, verify slug has `org_` prefix
4. Check: Did you create role in correct environment?

### "Permission denied" for user who should have access

**Root cause decision tree:**

```
Permission check failing?
  |
  +-- User has no role assigned
  |     --> Check organization membership API response
  |     --> Verify default role is set in dashboard
  |
  +-- User has role but role lacks permission
  |     --> Check role configuration in dashboard
  |     --> Verify permission name matches exactly
  |
  +-- Stale permission cache
        --> Clear cache, re-fetch role permissions
```

### "IdP role assignment not working"

**Root causes:**

1. **Group name mismatch**: IdP group name ≠ mapped name (case-sensitive)
   - Fix: Check IdP group names, update mapping
2. **User not in group**: User missing from IdP group
   - Fix: Add user to group in IdP, trigger resync
3. **Mapping not saved**: Dashboard mapping not applied
   - Fix: Recreate mapping, save explicitly
4. **Directory sync delay**: Changes not propagated yet
   - Fix: Wait for next sync cycle or trigger manual sync

**Verify IdP assignment:**

```bash
# Check user's directory groups
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/directory_sync/directory_users/{user_id}"

# Check SSO profile groups (after login)
# Groups should appear in profile data
```

### "Multiple roles not appearing in session"

**Root cause:** Multiple roles not enabled or session structure misunderstood.

**Fix:**
1. Check fetched docs for multiple role session format
2. Verify your dashboard has multiple role support enabled
3. Update session parsing to handle role array not single role

### "Organization role changes not reflecting"

**Root cause:** Caching layer or misunderstanding inheritance.

**Verify:**
1. Org role changes don't affect other orgs → by design
2. New environment roles placed at bottom → correct behavior
3. Check API response directly (bypass cache):

```bash
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organizations/{org_id}/roles"
```

### "Cannot delete environment role"

**Root cause:** Role is default for one or more organizations.

**Fix:**
1. Dashboard will prompt for replacement role
2. Select new default role for affected orgs
3. Retry deletion after replacement

## Related Skills

- **workos-authkit-nextjs**: AuthKit integration for role-aware sessions
- **workos-authkit-react**: Client-side auth with role data
- **workos-fga**: Fine-grained authorization beyond RBAC
