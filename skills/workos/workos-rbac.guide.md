<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs to get current RBAC implementation details:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check environment variables exist:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

- Confirm WorkOS SDK installed in `package.json` or equivalent
- Verify SDK import works in your language/framework

**Do not proceed until SDK is available.**

## Step 3: Dashboard Configuration (Decision Point)

RBAC requires role/permission setup in WorkOS Dashboard BEFORE code integration.

```
Role scope?
  |
  +-- Environment-level (shared across all orgs)
  |     --> Configure in Dashboard > Roles tab
  |     --> Use for global roles like "admin", "member"
  |
  +-- Organization-specific (custom per org)
        --> Configure in Dashboard > Organizations > [Org] > Roles tab
        --> Role slugs auto-prefixed with "org:"
        --> Use when orgs need custom permission sets
```

### Environment-Level Role Configuration

Navigate to Dashboard > Roles tab:

1. Define permissions (e.g., `videos:create`, `videos:view`, `settings:manage`)
2. Create roles and assign permission sets
3. Set default role (assigned to new members automatically)
4. Order roles by priority (for multiple role scenarios)

**Critical:** Permission naming convention is `{resource}:{action}`. Use lowercase, colon-separated.

### Organization Role Configuration

For custom org-level roles:

1. Navigate to Dashboard > Organizations > [Org] > Roles tab
2. Click "Create role"
3. Slug will be prefixed `org:` automatically
4. Assign permissions from environment-level permission set

**Behavior change:** Once first org role created, that org gets independent default role and priority order.

**Trap:** If you delete an environment role that's a default for orgs, you MUST select replacement role for all affected orgs.

## Step 4: Integration Pattern (Decision Tree)

```
Auth system?
  |
  +-- Using AuthKit
  |     --> Roles stored in organization memberships
  |     --> Read from session JWT (authkit.role, authkit.permissions)
  |     --> See Step 5a
  |
  +-- Using SSO (not AuthKit)
  |     --> Can use IdP role assignment
  |     --> See Step 5b
  |
  +-- Using Directory Sync
  |     --> Can use directory group role assignment
  |     --> See Step 5c
  |
  +-- Custom auth (API only)
        --> Manage roles via Organization Membership API
        --> See Step 5d
```

## Step 5a: AuthKit Integration

### Reading Roles from Session

AuthKit session JWTs contain role data. Parse JWT to access:

- `authkit.role` - primary role slug
- `authkit.permissions` - array of permission strings

**For multiple roles:** JWT will contain all assigned roles and merged permission set.

**Pattern for access checks:**

```typescript
// Pseudocode - check fetched docs for exact SDK method
const session = await getSession(); // SDK method from AuthKit
const hasPermission = session.permissions.includes('videos:create');

if (!hasPermission) {
  return unauthorizedResponse();
}
```

### Assigning Roles

**Default behavior:** New organization members get the default role automatically.

**To assign specific role:**

Use Organization Membership API. Check fetched docs for:
- Method to update organization membership
- Parameter name for role assignment (likely `roleSlug` or similar)

**For multiple roles:**

Check fetched docs for multiple role support. Assignment method depends on whether using:
- Group-based assignment (IdP groups → roles)
- Direct API assignment (array of role slugs)

**Precedence rule (CRITICAL):**

```
Role assignment precedence:
  IdP assignment (SSO or Directory)  <-- HIGHEST
  Dashboard manual assignment
  API assignment
  Default role                       <-- LOWEST
```

IdP assignment ALWAYS wins. If using IdP role assignment, do not attempt to override via API.

## Step 5b: SSO Integration (Without AuthKit)

For SSO profiles without AuthKit, use IdP group mappings.

### SSO Group Role Assignment

1. Navigate to Dashboard > [SSO Connection] > Group Mappings
2. Map IdP groups to WorkOS role slugs
3. User roles update on each authentication

**Behavior:** Role assignment happens at SSO authentication time, not provisioning time.

Check fetched docs for exact mapping configuration steps.

## Step 5c: Directory Sync Integration

For directory provisioning, map directory groups to roles.

### Directory Group Role Assignment

1. Navigate to Dashboard > [Directory Connection] > Group Mappings
2. Map directory groups to WorkOS role slugs
3. User roles update on directory sync events

**Behavior:** Role assignment happens when directory events fire (user added to group, etc.).

**Trap:** Directory sync updates are eventually consistent. Do not assume instant role changes.

Check fetched docs for event timing and retry behavior.

## Step 5d: Custom Auth (API Only)

If not using AuthKit/SSO/Directory, manage roles via Organization Membership API.

**Pattern for role assignment:**

```typescript
// Pseudocode - check fetched docs for exact SDK method
await workos.organizationMemberships.update({
  organizationMembershipId: 'om_...',
  roleSlug: 'admin' // or array for multiple roles
});
```

**For multiple roles:**

Check fetched docs for whether API accepts:
- Single `roleSlug` parameter
- Array of `roleSlugs`
- Separate `addRole`/`removeRole` methods

## Step 6: Implement Access Checks

### Permission Check Pattern

**Server-side enforcement (REQUIRED):**

```typescript
// Pseudocode - exact implementation varies by framework
async function protectedEndpoint(request) {
  const session = await getSession(request); // Get session from AuthKit or custom auth
  
  // Check permission
  if (!session.permissions.includes('videos:create')) {
    return { status: 403, body: 'Forbidden' };
  }
  
  // Proceed with business logic
  return createVideo(request.body);
}
```

**Client-side checks (optional, for UX only):**

- Show/hide UI elements based on permissions
- Always enforce server-side — client checks are for UX, not security

### Multiple Roles Behavior

When user has multiple roles:

- Permissions are MERGED (union, not intersection)
- User has permission if ANY assigned role grants it
- Role priority order only matters for display/default behavior

Check fetched docs for edge cases with conflicting role configurations.

## Step 7: Handle Role Updates

### Real-Time Role Changes

```
How to detect role changes?
  |
  +-- AuthKit users
  |     --> Session refresh (JWT refresh token flow)
  |     --> Check session.permissions on each request
  |
  +-- IdP-sourced roles
  |     --> Update on next SSO login (SSO groups)
  |     --> Update on directory sync event (directory groups)
  |
  +-- API-assigned roles
        --> Immediate effect
        --> Invalidate cached sessions
```

**Trap:** If caching sessions, you MUST invalidate cache when roles change via API. Otherwise users keep old permissions until session expires.

## Step 8: Organization Role Lifecycle

### Creating Organization Roles

**Trigger:** First org role created for an organization

**Automatic behavior:**

1. Org gets independent default role setting
2. Org gets independent priority order
3. Environment roles still visible, placed at bottom of org priority order

**To create org role via API:**

Check fetched docs for Organization Roles API endpoint. Slug will be auto-prefixed `org:`.

### Deleting Environment Roles

**If role is default for any org:**

1. Dashboard will prompt for replacement role
2. Select new default for all affected orgs
3. Members with deleted role are reassigned to new default

**Cannot delete via API without Dashboard confirmation** if role is in use.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm RBAC integration:

```bash
# 1. Environment variables present
env | grep -E 'WORKOS_(API_KEY|CLIENT_ID)' || echo "FAIL: Missing env vars"

# 2. SDK installed (adjust for your package manager)
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Dashboard has roles configured (manual check)
echo "MANUAL: Confirm roles exist in Dashboard > Roles tab"

# 4. Test permission check endpoint
curl -X POST http://localhost:3000/api/test-protected \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -w "\nStatus: %{http_code}\n"
# Should return 403 if user lacks permission, 200 if authorized

# 5. Build succeeds
npm run build || echo "FAIL: Build failed"
```

**Manual checks:**

- [ ] Dashboard > Roles tab shows at least one role
- [ ] Dashboard > Roles tab shows at least one permission
- [ ] Test user has role assigned in Dashboard > Organizations > [Org] > Members
- [ ] Protected endpoint returns 403 for unauthorized user
- [ ] Protected endpoint returns 200 for authorized user

## Error Recovery

### "Permission denied" for valid user

**Root causes:**

1. **User has wrong role** - Check Dashboard > Organizations > [Org] > Members
2. **Role missing permission** - Check Dashboard > Roles > [Role] > Permissions
3. **Stale session cache** - User role changed but session not refreshed

**Fixes:**

```bash
# Check user's current role
curl https://api.workos.com/organization_memberships/:id \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Verify role includes needed permission
# (Check Dashboard > Roles > [Role] > Permissions)

# Force session refresh (method depends on auth system)
# - AuthKit: Delete session cookie, force re-login
# - Custom: Invalidate cache, regenerate session
```

### "Role not found" error

**Root causes:**

1. **Role slug typo** - Role slugs are case-sensitive
2. **Organization role prefix missing** - Org roles need `org:` prefix
3. **Role deleted** - Role existed but was removed

**Fixes:**

```bash
# List all roles (environment-level)
curl https://api.workos.com/roles \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# For org roles, list via organization endpoint
# (Check fetched docs for organization roles list method)
```

**Slug format rules:**

- Environment roles: lowercase, underscores (e.g., `admin`, `video_editor`)
- Organization roles: auto-prefixed `org:` (e.g., `org:custom_role`)

### IdP role assignment not working

**Root causes:**

1. **Group mapping not configured** - Dashboard group mappings incomplete
2. **User not in mapped group** - Check IdP group membership
3. **SSO: Roles only update on login** - User must re-authenticate

**Fixes:**

```bash
# Verify group mappings in Dashboard
# Navigate to: [Connection] > Group Mappings

# Force user to re-authenticate (SSO)
# Delete session, user must sign in again

# Check directory sync events (Directory)
# Dashboard > [Directory] > Events log
```

**Timing trap:** Directory role updates happen on sync events. SSO role updates happen on authentication. They are NOT instant.

### Multiple roles not working

**Root causes:**

1. **SDK version doesn't support multiple roles** - Check fetched docs for version requirements
2. **API method expects array but receiving string** - Role assignment syntax wrong
3. **Environment config set to single-role mode** - Check Dashboard settings

**Fixes:**

Check fetched docs for:
- Multiple roles feature flag or environment setting
- Correct API parameter format (array vs. single value)
- SDK version compatibility

### Permission not appearing in session

**Root causes:**

1. **Permission not assigned to role** - Check Dashboard > Roles > [Role]
2. **Session cached before role updated** - Invalidate session cache
3. **JWT not parsed correctly** - Check claim names in fetched docs

**Fixes:**

```typescript
// Debug: Log full session object
console.log('Session:', JSON.stringify(session, null, 2));

// Verify JWT contains expected claims:
// - authkit.role (or authkit.roles for multiple)
// - authkit.permissions (array)
```

If claims missing, session generation is broken — check AuthKit integration.

## Related Skills

- workos-authkit-nextjs - For AuthKit integration with role-aware sessions
- workos-authkit-react - For client-side permission checks in React
