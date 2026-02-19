---
name: workos-migrate-descope
description: Migrate to WorkOS from Descope.
---

<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The Descope migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Planning

### Audit Descope Data

Answer these questions before writing code:

1. **Password export needed?**
   - Users sign in with passwords? → Yes, contact Descope support for password export
   - Social auth only? → No, skip password import steps

2. **Hashing algorithm used?**
   - Descope support will specify: `bcrypt`, `argon2`, or `pbkdf2`
   - Note this for Step 5

3. **Organization structure?**
   - Using Descope Tenants for B2B? → Map to WorkOS Organizations
   - Single-tenant app? → Skip organization steps

4. **Social auth providers?**
   - Which providers: Google, Microsoft, GitHub, etc.
   - Check WorkOS integrations page for each provider's setup

### Descope Data Export

**Password hashes (if needed):**
- Contact Descope support — hashes NOT available via API
- Request CSV with: `email`, `givenName`, `familyName`, `verifiedEmail`, `passwordHash`, `hashAlgorithm`
- Wait for secure transfer before continuing

**User data:**
```bash
# Use Descope Management API to export users
# Check Descope docs for exact API endpoint
```

**Tenant data (if using B2B):**
```bash
# Use Descope Management API to export tenants
# You'll need: tenant ID, tenant name
```

## Step 3: WorkOS Environment Setup

### Dashboard Configuration

1. Navigate to WorkOS Dashboard → Environment settings
2. Configure email verification policy (matches Descope behavior or stricter)
3. For each social auth provider in use:
   - Go to Integrations page
   - Add provider credentials (client ID, client secret)
   - Verify redirect URIs match your app

### API Key Verification

```bash
# Check API key format
echo $WORKOS_API_KEY | grep -E '^sk_' || echo "FAIL: Invalid API key format"

# Test API key with a simple call
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users?limit=1
# Should return 200, not 401
```

## Step 4: Import Users (Basic Data)

### Field Mapping

```
Descope export    → WorkOS API parameter
─────────────────────────────────────────
email             → email
givenName         → first_name
familyName        → last_name
verifiedEmail     → email_verified
```

### Migration Script Pattern

```typescript
// Pseudocode — adapt to your language/SDK
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY);

async function importUser(descopeUser) {
  return await workos.userManagement.createUser({
    email: descopeUser.email,
    firstName: descopeUser.givenName,
    lastName: descopeUser.familyName,
    emailVerified: descopeUser.verifiedEmail,
    // Do NOT include password yet — see Step 5
  });
}

// CRITICAL: Respect rate limits
// Check WorkOS rate limits doc for current values
// Implement exponential backoff on 429 responses
```

### Rate Limiting Strategy

WorkOS APIs are rate-limited. For large migrations:

1. Batch imports (e.g., 100 users per batch)
2. Add delay between batches (e.g., 1 second)
3. Handle 429 responses with exponential backoff
4. Track failures for retry

**Verify:** Import a single test user successfully before batching.

## Step 5: Import Passwords (If Applicable)

### Decision Tree

```
Password export from Descope?
  |
  +-- No  --> Skip this step
  |
  +-- Yes --> Which algorithm?
                |
                +-- bcrypt  --> Use password_hash_type: 'bcrypt'
                |
                +-- argon2  --> Use password_hash_type: 'argon2'
                |
                +-- pbkdf2  --> Use password_hash_type: 'pbkdf2'
```

### Import Pattern

Choose one:

**Option A: During user creation**
```typescript
await workos.userManagement.createUser({
  email: descopeUser.email,
  firstName: descopeUser.givenName,
  lastName: descopeUser.familyName,
  emailVerified: descopeUser.verifiedEmail,
  passwordHash: descopeUser.passwordHash,      // From Descope CSV
  passwordHashType: 'bcrypt',                   // Or argon2/pbkdf2
});
```

**Option B: Update after creation**
```typescript
// First create user (Step 4)
const user = await workos.userManagement.createUser({...});

// Then update with password
await workos.userManagement.updateUser({
  userId: user.id,
  passwordHash: descopeUser.passwordHash,
  passwordHashType: 'bcrypt',
});
```

**CRITICAL:** The `passwordHashType` MUST match the algorithm Descope support specified.

### Verification

Test password import with a single user:
1. Import user with password hash
2. Attempt sign-in via AuthKit with original password
3. Should succeed without password reset

## Step 6: Organizations (If Using B2B)

### Creating Organizations

Use Descope Management API to fetch tenants, then map to WorkOS Organizations:

```
Descope Tenant    → WorkOS Organization
──────────────────────────────────────────
name              → name
id                → external_id (recommended)
```

**Why external_id:** Preserves Descope tenant ID for cross-reference during migration.

```typescript
async function importOrganization(descopeTenant) {
  return await workos.organizations.createOrganization({
    name: descopeTenant.name,
    externalId: descopeTenant.id,  // Preserves Descope ID
  });
}
```

**Keep a mapping:** `{ descopeTenantId: workosOrgId }` for Step 7.

### Domain Management

If Descope tenants had domain restrictions:
1. Add domains to WorkOS Organizations via Dashboard or API
2. Check fetched docs for domain API endpoints

## Step 7: Organization Memberships

### Adding Users to Organizations

Use Descope's user-tenant associations to create memberships:

```typescript
async function createMembership(workosUserId, workosOrgId, roleSlug?) {
  return await workos.userManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId,
    roleSlug: roleSlug,  // Optional — see RBAC section
  });
}
```

### RBAC Migration

If using roles in Descope:

1. **Define roles in WorkOS Dashboard:**
   - Navigate to dashboard.workos.com/environment/authorization
   - Create roles matching Descope role names
   - Assign permissions to each role

2. **Map role slugs during membership creation:**
   ```
   Descope role name → WorkOS roleSlug (dashboard-defined)
   ```

3. **Pass roleSlug when creating membership** (see code above)

**CRITICAL:** Roles MUST be created in Dashboard BEFORE assigning via API.

## Step 8: Social Auth Migration

### Provider Setup

For each social auth provider users signed in with (Google, Microsoft, GitHub, etc.):

1. Go to WorkOS Dashboard → Integrations
2. Click provider name
3. Add OAuth credentials:
   - Client ID
   - Client Secret
   - Authorized redirect URIs (must match your app)

**Verify:** Complete OAuth flow for each provider before migration.

### User Linking

WorkOS auto-links social auth users by **email address**:

1. User signs in via social provider (e.g., Google)
2. WorkOS checks if a user with that email exists
3. If exists → links social identity to existing user
4. If not → creates new user

**Email verification edge case:**

Some users may need email verification after first social sign-in. This depends on:
- Environment email verification settings
- Whether provider is "trusted" (e.g., Google with @gmail.com)

Check fetched docs for provider-specific email verification behavior.

## Step 9: Cutover Strategy

### Pre-Cutover Validation

Run these checks BEFORE switching users to WorkOS:

```bash
# 1. Confirm user count matches
DESCOPE_COUNT=$(curl -s descope-api/users | jq '.total')
WORKOS_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.total')
echo "Descope: $DESCOPE_COUNT, WorkOS: $WORKOS_COUNT"

# 2. Test password authentication for sample users
# (manual test via AuthKit)

# 3. Test social auth for each provider
# (manual test via AuthKit)

# 4. Verify organization memberships
# (spot-check via WorkOS Dashboard)
```

### Cutover Options

**Option A: Hard cutover**
- Switch all users at once
- Highest risk, fastest migration

**Option B: Gradual rollout**
- Flag-based routing: some users → WorkOS, others → Descope
- Lower risk, longer migration window
- Requires dual auth support in application

### Post-Cutover Monitoring

Monitor for:
- Failed sign-in attempts (check WorkOS logs)
- Missing organization memberships
- Password hash mismatches
- Social auth linking failures

## Verification Checklist (ALL MUST PASS)

```bash
# 1. API key valid and authorized
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users?limit=1 | jq '.object'
# Expected: "list"

# 2. User count matches export
WORKOS_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.total')
echo "WorkOS users: $WORKOS_COUNT"
# Should match Descope export count

# 3. Password authentication works
# Manual: Sign in via AuthKit with test user's password
# Expected: Success without password reset

# 4. Social auth providers configured
# Manual: Check WorkOS Dashboard → Integrations
# Expected: All providers show "Connected"

# 5. Organizations created (if B2B)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'
# Should match Descope tenant count

# 6. Sample membership query works
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?user_id=USER_ID" \
  | jq '.data | length'
# Should return expected membership count for test user
```

## Error Recovery

### "Invalid password hash" during import

**Cause:** `passwordHashType` doesn't match Descope's actual algorithm.

**Fix:**
1. Re-check with Descope support which algorithm was used
2. Verify WorkOS supports that algorithm (bcrypt, argon2, pbkdf2)
3. Update import script with correct `passwordHashType`

### "User already exists" during import

**Cause:** Duplicate email or retrying failed import.

**Fix:**
1. Check if user exists: `workos.userManagement.getUser({ email: '...' })`
2. If exists, use UPDATE instead of CREATE
3. Or skip and continue if initial import succeeded

### Rate limit 429 errors

**Cause:** Exceeded WorkOS API rate limits.

**Fix:**
1. Implement exponential backoff (wait 2^n seconds)
2. Reduce batch size
3. Add delays between batches (1-2 seconds)

### Social auth user not linking

**Cause:** Email mismatch or email not verified in WorkOS.

**Fix:**
1. Confirm user's WorkOS email matches social provider email
2. Check `emailVerified` flag on WorkOS user
3. If provider requires verification, user must complete verification flow

### "Organization not found" during membership creation

**Cause:** Organization wasn't created yet or ID mismatch.

**Fix:**
1. Verify organization exists: `workos.organizations.getOrganization({ organizationId: '...' })`
2. Check organization ID mapping from Step 6
3. Create organization if missing

### "Role not found" during membership creation

**Cause:** Role slug doesn't exist in WorkOS Dashboard.

**Fix:**
1. Navigate to dashboard.workos.com/environment/authorization
2. Verify role exists with exact slug used in code
3. Create role if missing BEFORE retrying membership creation

## Related Skills

- `workos-authkit-nextjs` — Integrate AuthKit after migration
- `workos-authkit-react` — Client-side auth UI
- `workos-authkit-vanilla-js` — Framework-agnostic AuthKit
