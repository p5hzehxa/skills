<!-- refined:sha256:7b0523b5590f -->

# WorkOS Role-Based Access Control

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/rbac/quick-start
- https://workos.com/docs/rbac/organization-roles
- https://workos.com/docs/rbac/integration
- https://workos.com/docs/rbac/index
- https://workos.com/docs/rbac/idp-role-assignment
- https://workos.com/docs/rbac/configuration

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Detect existing WorkOS SDK installation:

```bash
# Check package.json or equivalent for WorkOS SDK
grep -E "@workos-inc|workos" package.json requirements.txt Gemfile composer.json
```

**Verify:** SDK package exists before writing imports.

## Step 3: Configuration Strategy (Decision Tree)

Choose role scope based on tenant isolation needs:

```
Role scope?
  |
  +-- Same roles across all organizations
  |   --> Use environment-level roles (Dashboard > Roles)
  |
  +-- Different roles per organization
  |   --> Use organization-level roles (Dashboard > Organization > Roles tab)
  |
  +-- Hybrid (some custom, some shared)
      --> Environment roles + organization overrides
```

**Critical:** Organization roles take precedence over environment roles. Once you create an organization role, that org has its own default role and priority order.

### Organization Role Prefixes

- Environment roles: custom slug (e.g., `admin`, `member`)
- Organization roles: auto-prefixed with `org` (e.g., `org:custom-admin`)

**Trap:** Do NOT manually prefix organization role slugs — WorkOS adds `org:` automatically.

## Step 4: Role Assignment Strategy (Decision Tree)

```
How are roles assigned?
  |
  +-- Manual assignment (API/Dashboard)
  |   --> Use Organization Membership API
  |
  +-- From customer's IdP
  |   |
  |   +-- SSO-based
  |   |   --> SSO group mappings (updates on each auth)
  |   |
  |   +-- Directory Sync-based
  |       --> Directory group mappings (updates on directory events)
  |
  +-- Hybrid
      --> IdP assignments take precedence over manual
```

**Critical precedence rule:** IdP role assignment ALWAYS overrides API/Dashboard assignments. If a user has both:
1. IdP-assigned role from SSO/Directory
2. Manually assigned role via API

The IdP role wins. Manual assignment will be overwritten.

### Multiple Roles

Check fetched docs for whether your integration pattern supports multiple roles:

- **Group-based assignment:** User in multiple mapped groups receives ALL roles
- **Single role enforcement:** Configure in Dashboard > Roles > Priority Order

## Step 5: Dashboard Configuration

### Environment-Level Roles (Shared)

1. Navigate: Dashboard > Roles
2. Create roles with slugs (e.g., `admin`, `member`, `viewer`)
3. Assign permissions to each role
4. Set default role (auto-assigned to new org members)
5. Set priority order (for role precedence)

### Organization-Level Roles (Custom)

1. Navigate: Dashboard > Organizations > [Org] > Roles tab
2. Click "Create role" (first role triggers org-specific config)
3. Create role — slug auto-prefixed with `org:`
4. Set org-specific default role and priority

**Trap:** Deleting an environment role that's a default for orgs requires choosing a replacement. This bulk-updates all affected org members.

## Step 6: Access Checks in Application

### Reading Roles from Session

Check fetched docs for session format. Roles typically available as:

- JWT claims (AuthKit sessions)
- API response fields (Organization Membership API)

**Pattern for access checks:**

```
1. Extract user's role(s) from session/membership
2. Check role slug against expected value(s)
3. Optional: Check specific permissions if role has multiple
```

**Trap:** Do NOT hardcode permission checks without checking role-permission mappings — permissions can change in Dashboard without code deploy.

### API-Based Access Checks

Use SDK method for fetching organization membership with roles. Check fetched docs for exact method signature.

**Pattern:**

1. Get user's organization membership(s)
2. Extract `role` or `roles` field
3. Compare against expected role slugs

## Step 7: IdP Role Assignment (Optional)

If using SSO or Directory Sync, map IdP groups to WorkOS roles:

### SSO Group Mapping

- Navigate: Dashboard > SSO > [Connection] > Group Mappings
- Map IdP group names to role slugs
- Roles update on each user authentication

### Directory Group Mapping

- Navigate: Dashboard > Directory Sync > [Directory] > Group Mappings
- Map directory group names to role slugs
- Roles update on directory sync events

**Critical:** IdP mappings override manual assignments. Document this for your support team.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup:

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID

# 2. Verify SDK import works (language-specific)
# Node.js example:
node -e "require('@workos-inc/node')" 2>&1 | grep -v Error

# 3. Test API connectivity
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organizations | jq .

# 4. Verify Dashboard config
# Manual check: Dashboard > Roles shows at least one role with permissions
```

**If check #3 fails:** Verify API key is correct and has permissions.

## Error Recovery

### "Role not found" in access checks

**Causes:**

1. Role slug mismatch (check for `org:` prefix on organization roles)
2. User's org membership missing role assignment
3. IdP mapping not configured (if using SSO/Directory)

**Fix:**

- Check exact role slug in Dashboard > Roles or Organization > Roles
- Verify user's membership has role: API call or Dashboard > Organizations > [Org] > Members
- For IdP: verify group mapping exists and user is in mapped group

### "Default role not set" warning

**Cause:** No default role configured for environment or organization.

**Fix:**

- Environment: Dashboard > Roles > gear icon > Set default
- Organization: Dashboard > Organizations > [Org] > Roles > gear icon > Set default

### Role assignment doesn't persist (IdP override)

**Cause:** IdP role assignment is overwriting manual assignment.

**Fix pattern:**

1. Confirm IdP mapping exists: Dashboard > SSO/Directory > Group Mappings
2. Either:
   - Remove IdP mapping (manual assignment will persist), or
   - Change IdP group membership (assignment follows IdP)

**Do NOT fight IdP assignment** — it's designed to be authoritative.

### "Multiple roles not supported"

**Cause:** Integration pattern only supports single role, but user has multiple.

**Fix:** Check fetched docs for multiple role support in your integration pattern. If unsupported:

- Enforce single role via Dashboard > Roles > Priority Order
- Highest priority role will be effective role

### API returns 401 "Unauthorized"

**Causes:**

1. `WORKOS_API_KEY` invalid or expired
2. Key doesn't have User Management scope

**Fix:**

- Regenerate key: Dashboard > API Keys > Create key
- Verify scopes include necessary permissions

### SDK method signature mismatch

**Cause:** SDK version incompatible with code examples.

**Fix:**

- Check SDK version in package manifest
- WebFetch the SDK README for correct version's API
- Consider upgrading SDK to latest

## Related Skills

For implementing authentication before RBAC:

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
