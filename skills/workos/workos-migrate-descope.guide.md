<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check WorkOS Dashboard:
- Authentication method enabled (password + any social providers you'll migrate)
- Environment-level settings match current Descope config
- API keys provisioned (`WORKOS_API_KEY` starts with `sk_`, `WORKOS_CLIENT_ID` starts with `client_`)

### SDK Installation

Verify WorkOS SDK installed before writing migration scripts:

```bash
# Check SDK exists
ls node_modules/@workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

### Migration Scope Assessment

Map your Descope data model to WorkOS:

```
What are you migrating?
  |
  +-- Password users? --> Open Descope support ticket for hash export (REQUIRED)
  |                       (Hashes not available via API - support ticket is mandatory)
  |
  +-- Social auth users? --> List providers, configure each in WorkOS Dashboard
  |                          Check fetched docs for provider-specific setup
  |
  +-- Tenants? --> Plan Organization creation + membership mapping
  |
  +-- RBAC roles? --> Create matching roles in WorkOS Dashboard BEFORE importing memberships
```

**Critical:** Descope does NOT expose password hashes via API. If migrating passwords, the support ticket is not optional - there is no API workaround.

## Step 3: Export Data from Descope

### Password Export (via Support Ticket)

**Blocking step if migrating password users.**

1. Open ticket with Descope support requesting user export with password hashes
2. Specify which hashing algorithm(s) your users have (bcrypt, argon2, pbkdf2)
3. Receive CSV with user data + hashes via secure transfer
4. Note the `password_hash_type` value - you'll need exact algorithm name for WorkOS import

### User Export (via API)

Use Descope Management API to export user data:

```typescript
// Pseudocode - check Descope SDK docs for exact method
const users = await descopeClient.searchUsers({ /* filters */ });
```

Fields to extract for WorkOS mapping:

- `email` → WorkOS `email`
- `givenName` → WorkOS `first_name`
- `familyName` → WorkOS `last_name`
- `verifiedEmail` → WorkOS `email_verified`
- Tenant associations → WorkOS organization memberships (if applicable)

### Tenant Export (via API)

If using Descope tenants (B2B model):

```typescript
// Pseudocode - check Descope SDK docs for exact method
const tenants = await descopeClient.listTenants();
```

Fields to extract:

- `id` → WorkOS `external_id` (preserves reference during migration)
- `name` → WorkOS `name`

**Store tenant mapping:** Create `descope_tenant_id → workos_org_id` lookup for Step 5.

## Step 4: Import Users into WorkOS

### Rate Limit Strategy (CRITICAL)

WorkOS Create User API is rate-limited. Check fetched docs for current limits.

For large migrations (>1000 users), implement batching:

```typescript
// Pattern - exact SDK method in fetched docs
async function batchImportUsers(users, batchSize = 50) {
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    await Promise.all(batch.map(importUser));
    // Delay between batches - check rate limit docs for timing
    await sleep(1000);
  }
}
```

### Import with Passwords

Use `userManagement.createUser` with password hash parameters:

```typescript
// Pattern using SDK method from docs
await userManagement.createUser({
  email: descopeUser.email,
  firstName: descopeUser.givenName,
  lastName: descopeUser.familyName,
  emailVerified: descopeUser.verifiedEmail,
  passwordHash: descopeUser.passwordHash,        // From support export
  passwordHashType: 'bcrypt'                     // Or 'argon2', 'pbkdf2'
});
```

**Supported algorithms:** bcrypt, argon2, pbkdf2 (match to Descope export)

### Import Social Auth Users (No Password)

For users who only used social auth in Descope:

```typescript
await userManagement.createUser({
  email: descopeUser.email,
  firstName: descopeUser.givenName,
  lastName: descopeUser.familyName,
  emailVerified: descopeUser.verifiedEmail
  // No password fields
});
```

**Auto-linking:** When users sign in via social provider (Google, Microsoft, etc.), WorkOS matches by email address and links to existing user.

**Email verification edge case:** If WorkOS environment has email verification enabled AND provider doesn't guarantee verified emails (non-Gmail Google accounts, custom domains), user must verify after first login. Check fetched docs for provider verification status.

### Store User ID Mapping

Create lookup for organization membership import:

```typescript
const userIdMap = new Map<string, string>(); // descope_user_id → workos_user_id
userIdMap.set(descopeUser.id, workosUser.id);
```

## Step 5: Import Organizations (B2B Only)

Skip if not using Descope tenants.

### Create Organizations

```typescript
// Pattern using SDK method from docs
async function migrateOrganization(descopeTenant) {
  const org = await organizationManagement.createOrganization({
    name: descopeTenant.name,
    externalId: descopeTenant.id  // Preserves Descope reference
  });
  
  orgIdMap.set(descopeTenant.id, org.id);
  return org;
}
```

**External ID purpose:** Maintains bidirectional reference during migration. If you need to look up which Descope tenant a WorkOS org came from, query by `external_id`.

### Configure RBAC Roles (BEFORE Memberships)

**Blocking step if using role-based access.**

1. List all roles defined in Descope
2. Go to WorkOS Dashboard → Authorization → Roles
3. Create matching roles (name + permissions)
4. Note the `roleSlug` for each - you'll use this in membership creation

**Do NOT skip this:** Creating memberships with `roleSlug` that doesn't exist will fail.

## Step 6: Import Organization Memberships

**Decision tree for membership data:**

```
Where is user-tenant association stored?
  |
  +-- Descope user object has tenant list? --> Extract from user export
  |
  +-- Descope tenant object has user list? --> Extract from tenant export
  |
  +-- Separate association table/API? --> Query association endpoint
```

### Create Memberships with Roles

```typescript
// Pattern using SDK method from docs
async function createMembership(descopeUserTenant) {
  const workosUserId = userIdMap.get(descopeUserTenant.userId);
  const workosOrgId = orgIdMap.get(descopeUserTenant.tenantId);
  const roleSlug = roleMapping.get(descopeUserTenant.role); // From Step 5
  
  await organizationManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId,
    roleSlug: roleSlug  // Optional - omit if no RBAC
  });
}
```

**Role mapping:** Match Descope role names to WorkOS `roleSlug` values created in Dashboard.

## Step 7: Configure Social Providers

For each social auth provider you're migrating (Google, Microsoft, etc.):

1. Check fetched docs → Integrations → [Provider Name]
2. Follow provider-specific OAuth setup (client ID, client secret, callback URLs)
3. Configure in WorkOS Dashboard → Authentication → Social Connections

**Email matching:** When migrated user signs in via provider, WorkOS auto-links to existing user by email. No additional code needed.

## Verification Checklist (ALL MUST PASS)

Run these checks after migration:

```bash
# 1. Verify user count matches
echo "Descope users: $(count_descope_users)"
echo "WorkOS users: $(workos users list --limit 1000 | jq length)"

# 2. Test password authentication
# (Manual) Log in as migrated user with password

# 3. Test social auth linking
# (Manual) Log in as migrated user with Google/Microsoft - should link to existing account

# 4. Verify organization memberships (if applicable)
workos organizations list-members --organization-id org_xxx

# 5. Test RBAC (if applicable)
# (Manual) Verify user has expected role permissions in app
```

**If user counts don't match:** Check API error logs for failed imports. Common issues: duplicate emails, invalid email format, rate limit exceeded.

## Error Recovery

### "Password hash import failed"

**Cause:** Mismatch between Descope hash algorithm and WorkOS `passwordHashType` parameter.

Fix:
1. Verify hash algorithm from Descope support export
2. Ensure `passwordHashType` matches exactly: `'bcrypt'`, `'argon2'`, or `'pbkdf2'` (case-sensitive)
3. Check fetched docs for supported algorithm list - Descope may use variant WorkOS doesn't support

### "Rate limit exceeded" during import

**Cause:** Too many Create User calls too quickly.

Fix:
1. Check fetched docs for current rate limits
2. Implement batching with delays (see Step 4 pattern)
3. For very large migrations (>10k users), consider contacting WorkOS support for temporary limit increase

### "Organization not found" when creating membership

**Cause:** Organization wasn't created or ID mapping is wrong.

Fix:
1. Verify organization exists: `workos organizations get --id org_xxx`
2. Check `orgIdMap` has entry for Descope tenant ID
3. Ensure Step 5 completed before Step 6

### "Role not found" when creating membership

**Cause:** `roleSlug` doesn't exist in WorkOS Dashboard.

Fix:
1. Go to Dashboard → Authorization → Roles
2. Verify role with matching slug exists
3. Create role if missing, then retry membership creation

### Social auth user not auto-linking

**Cause:** Email mismatch or WorkOS user doesn't exist yet.

Fix:
1. Verify user was imported in Step 4 (check by email)
2. Ensure email in social provider profile exactly matches WorkOS user email
3. Check provider configuration in Dashboard (client ID/secret correct)

### Duplicate email error on user import

**Cause:** User already exists in WorkOS (from previous migration attempt or manual creation).

Decision tree:
```
User exists?
  |
  +-- From failed migration? --> Delete user, retry import
  |
  +-- Legitimately duplicate? --> Use Update User API instead of Create User
  |
  +-- Should merge? --> Import as different email, manually merge later
```

Check fetched docs for Update User API if you need to update existing users instead of creating.

## Related Skills

- workos-authkit-nextjs - For implementing authentication UI after migration
- workos-authkit-react - For React-based authentication UI
