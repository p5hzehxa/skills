<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The fetched docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### WorkOS Account Setup

- Confirm WorkOS Dashboard access
- Confirm environment has `WORKOS_API_KEY` (starts with `sk_`)
- Confirm environment has `WORKOS_CLIENT_ID` (starts with `client_`)

### Descope Access

- Confirm Descope Dashboard access with admin privileges
- Confirm ability to access Descope Management API
- If migrating passwords: confirm support ticket process for CSV export

### Project Structure

- Confirm WorkOS SDK installed (`@workos-inc/node` or equivalent for your runtime)
- Confirm migration script environment (Node.js, Python, etc.)

## Step 3: Password Export Decision Tree (if using password auth)

```
Need to import passwords?
  |
  +-- YES --> Contact Descope support for CSV export
  |           (Backend API does not expose password hashes)
  |           Note the hashing algorithm used (bcrypt, argon2, pbkdf2, etc.)
  |
  +-- NO  --> Proceed to Step 4
```

**If YES:** Open Descope support ticket requesting user data export with password hashes. Descope will facilitate secure data transfer. **Wait for CSV before proceeding to user import.**

Check fetched docs for supported hash algorithms — WorkOS supports bcrypt, argon2, and pbkdf2 from Descope exports.

## Step 4: Export Users from Descope

Use Descope Management API to export user data.

**Required fields from export:**
- `email` (required)
- `givenName` (maps to first_name)
- `familyName` (maps to last_name)
- `verifiedEmail` (maps to email_verified)
- Tenant associations (for organization memberships)
- Password hash (if received from support)

**Verification:**
```bash
# Check export file exists and contains required fields
head -n 1 descope_users.csv | grep -E "email|givenName|familyName"
```

## Step 5: Export Tenants from Descope (if using B2B)

```
Application model?
  |
  +-- B2C (individual users) --> Skip to Step 7
  |
  +-- B2B (tenants/orgs)     --> Export tenants via Descope Management API
```

**If B2B:** Use Descope Management API to retrieve all tenants.

**Required fields from export:**
- `id` (store as external_id in WorkOS)
- `name` (maps to organization name)

## Step 6: Create Organizations in WorkOS

**Endpoint:** `POST /organizations`

**Field mapping:**
```
Descope tenant.name → WorkOS name
Descope tenant.id   → WorkOS external_id
```

**Rate limit awareness:** Check fetched docs for current rate limits. For large migrations, batch requests with delays.

**Pseudocode pattern:**
```typescript
for each tenant in descopeTenantsExport:
  workosOrg = userManagement.organizations.createOrganization({
    name: tenant.name,
    external_id: tenant.id
  })
  
  // Store mapping: descope_tenant_id -> workos_org_id
  orgIdMap[tenant.id] = workosOrg.id
```

**Verification:**
```bash
# Check organizations created
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'
```

## Step 7: Import Users into WorkOS

**Endpoint:** `POST /user_management/users`

**Field mapping:**
```
Descope email         → WorkOS email (required)
Descope givenName     → WorkOS first_name
Descope familyName    → WorkOS last_name
Descope verifiedEmail → WorkOS email_verified
```

**Rate limit handling:** Check fetched docs for current rate limits. Implement batching with delays for large migrations.

**Pseudocode pattern (without passwords):**
```typescript
for each user in descopeUsersExport:
  workosUser = userManagement.createUser({
    email: user.email,
    first_name: user.givenName,
    last_name: user.familyName,
    email_verified: user.verifiedEmail
  })
  
  // Store mapping: descope_user_email -> workos_user_id
  userIdMap[user.email] = workosUser.id
```

**Pseudocode pattern (with passwords):**
```typescript
for each user in descopeUsersExport:
  workosUser = userManagement.createUser({
    email: user.email,
    first_name: user.givenName,
    last_name: user.familyName,
    email_verified: user.verifiedEmail,
    password_hash: user.passwordHash,
    password_hash_type: 'bcrypt' // or 'argon2', 'pbkdf2' from Descope export
  })
  
  userIdMap[user.email] = workosUser.id
```

**CRITICAL:** `password_hash_type` must match the algorithm Descope support specified. If mismatch, users cannot sign in.

**If passwords not available during initial import:** Use `PATCH /user_management/users/:id` to update passwords later.

**Verification:**
```bash
# Check users created
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length'

# Verify a sample user has password (if imported)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users/$SAMPLE_USER_ID | jq '.password_hash'
```

## Step 8: Create Organization Memberships (if B2B)

**Skip if B2C application.**

**Endpoint:** `POST /user_management/organization_memberships`

Use tenant association data from Descope user export to determine which users belong to which organizations.

**Pseudocode pattern:**
```typescript
for each user in descopeUsersExport:
  for each tenantId in user.associatedTenants:
    userManagement.organizationMemberships.createOrganizationMembership({
      user_id: userIdMap[user.email],
      organization_id: orgIdMap[tenantId],
      role_slug: mapDescopeRoleToWorkOS(user.role) // if using RBAC
    })
```

**RBAC migration:** If Descope roles exist, create equivalent roles in WorkOS Dashboard under Authorization → Roles. Then pass `role_slug` parameter when creating memberships.

**Verification:**
```bash
# Check memberships created for sample org
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=$SAMPLE_ORG_ID" | jq '.data | length'
```

## Step 9: Configure Social Auth Providers (if used)

```
Users sign in via social providers?
  |
  +-- NO  --> Skip to Step 10
  |
  +-- YES --> Configure provider credentials in WorkOS Dashboard
```

**If YES:** Navigate to WorkOS Dashboard → Authentication → Social Connections.

**Supported providers from Descope:**
- Google OAuth
- Microsoft OAuth
- Others — check fetched docs for full list

**Configuration:**
1. For each provider used in Descope, configure OAuth credentials in WorkOS
2. WorkOS will auto-link users by email address on first social sign-in
3. Check fetched docs for email verification behavior per provider

**CRITICAL:** Users signing in via social auth after migration will be matched by email address. If `email_verified=false` in WorkOS and verification is enabled, users may need to verify email.

**Email verification exceptions:** Check fetched docs for which providers skip verification (e.g., Google OAuth with gmail.com domain).

## Step 10: Update Application Code

### Replace Descope SDK calls with WorkOS SDK

**Common replacements:**
```
Descope SDK                    --> WorkOS SDK equivalent
descopeClient.me()            --> See workos-authkit-* skills for session handling
descopeClient.refresh()       --> Handled by AuthKit middleware
descopeClient.logout()        --> signOut() from WorkOS SDK
```

**Integration patterns:** See Related Skills section for runtime-specific implementation.

### Update environment variables

```bash
# Remove Descope vars
- DESCOPE_PROJECT_ID
- DESCOPE_MANAGEMENT_KEY

# Add WorkOS vars
+ WORKOS_API_KEY
+ WORKOS_CLIENT_ID
+ WORKOS_COOKIE_PASSWORD (32+ characters)
+ NEXT_PUBLIC_WORKOS_REDIRECT_URI (or equivalent for your runtime)
```

## Verification Checklist (ALL MUST PASS)

Run these commands after migration. **Do not mark complete until all pass:**

```bash
# 1. Verify organization count matches Descope tenant count (if B2B)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'

# 2. Verify user count matches Descope export
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length'

# 3. Verify sample user has password hash (if passwords imported)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users/$SAMPLE_USER_ID | jq '.password_hash'

# 4. Verify organization memberships exist (if B2B)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=$SAMPLE_ORG_ID" | jq '.data | length'

# 5. Test authentication flow in staging
# Attempt sign-in with migrated user credentials
```

**Critical test:** Have a test user from Descope sign in to the migrated WorkOS environment. Verify:
- Password auth works (if imported)
- Social auth works (if configured)
- User lands in correct organization (if B2B)
- Session persists across requests

## Error Recovery

### "User creation failed: email already exists"

**Root cause:** Duplicate migration attempt or user already exists in WorkOS.

**Fix:**
1. Query WorkOS for existing user by email before creating
2. Use `external_id` field to track migration status
3. Implement idempotent migration script with skip logic

### "Invalid password_hash_type"

**Root cause:** Mismatch between Descope export algorithm and WorkOS parameter.

**Fix:**
1. Verify hash algorithm from Descope support documentation
2. Check fetched docs for exact parameter values (bcrypt, argon2, pbkdf2)
3. Confirm no typos in `password_hash_type` field

### "Rate limit exceeded during migration"

**Root cause:** Exceeded API rate limits during bulk import.

**Fix:**
1. Check fetched docs for current rate limits
2. Implement batch delays: sleep 1 second per 10 requests (adjust per docs)
3. Use exponential backoff on 429 responses

### "Organization membership creation failed: user not found"

**Root cause:** User import incomplete or user ID mapping incorrect.

**Fix:**
1. Verify all users imported before creating memberships
2. Check `userIdMap` contains correct Descope email → WorkOS ID mapping
3. Query WorkOS API to confirm user exists before membership creation

### "Social auth user not linking after migration"

**Root cause:** Email mismatch or verification required.

**Fix:**
1. Confirm email in Descope export exactly matches provider email
2. Check if `email_verified=true` was set during import
3. Check fetched docs for provider-specific verification behavior
4. Verify OAuth provider credentials configured in WorkOS Dashboard

### "Password authentication fails for migrated users"

**Root cause:** Incorrect hash algorithm or malformed hash value.

**Fix:**
1. Verify `password_hash_type` matches algorithm from Descope support
2. Confirm hash value transferred correctly from CSV (no truncation)
3. Test with known password from Descope environment
4. Check if hash encoding matches WorkOS expectations (base64, hex, etc.)

### SDK import errors

**Root cause:** SDK not installed or wrong import path.

**Fix:**
```bash
# Verify SDK installed
npm list @workos-inc/node || yarn why @workos-inc/node

# Check import path matches SDK version in package.json
```

## Related Skills

- workos-authkit-nextjs — Integrate AuthKit with Next.js App Router
- workos-authkit-react — Integrate AuthKit with React applications
- workos-authkit-vanilla-js — Integrate AuthKit with vanilla JavaScript
