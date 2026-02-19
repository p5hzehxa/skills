<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Setup

- Confirm `WORKOS_API_KEY` exists (starts with `sk_`)
- Confirm `WORKOS_CLIENT_ID` exists (starts with `client_`)
- Verify SDK installed and importable in your project

### Descope Export Requirements

Check your Descope export format:

```
Password-based users?
  |
  +-- YES --> Contact Descope support for password hash export
  |            (Backend API does NOT expose hashes - support ticket required)
  |
  +-- NO  --> Proceed with user export only
```

**CRITICAL:** Descope does not expose password hashes via API. You MUST open a support ticket to obtain them.

## Step 3: Export Users from Descope

### User Data Export

Use Descope Management API to export users. Check fetched docs for API endpoint details.

**Required fields to capture:**
- `email`
- `givenName`
- `familyName`
- `verifiedEmail`
- Tenant associations (if using B2B features)

### Password Hash Export (if needed)

Open support ticket with Descope requesting password hash export. When you receive the CSV:

**CRITICAL:** Note which hashing algorithm was used. WorkOS supports:
- `bcrypt`
- `argon2`
- `pbkdf2`

Store this algorithm name — you'll pass it as `password_hash_type` during import.

## Step 4: Import Users into WorkOS

### Field Mapping (Decision Tree)

```
For each Descope user:
  |
  +-- Map email      --> email
  +-- Map givenName  --> first_name
  +-- Map familyName --> last_name
  +-- Map verifiedEmail --> email_verified
  |
  +-- Has password hash?
  |     |
  |     +-- YES --> Include password_hash + password_hash_type
  |     |
  |     +-- NO  --> Omit password fields (social auth only)
  |
  +-- Call userManagement.createUser()
```

### Rate Limiting Strategy

The Create User API is rate-limited. For large migrations:

```
Total users?
  |
  +-- < 100   --> Sequential import acceptable
  |
  +-- 100+    --> Implement batching with delays
                   Check fetched docs for current rate limits
```

**Trap Warning:** Do NOT parallelize all requests — you'll hit rate limits and lose track of failures. Batch in groups of 10-50 with pauses.

### Password Import

If importing passwords, set these parameters in `userManagement.createUser()`:

- `password_hash_type`: The algorithm from Step 3 (e.g., `'bcrypt'`)
- `password_hash`: The hash value from Descope export

**You can also import passwords later** using `userManagement.updateUser()` if you initially migrate users without passwords.

## Step 5: Migrate Social Auth Users

### Provider Configuration

For users who authenticated via social providers (Google, Microsoft, etc.):

1. Configure provider OAuth credentials in WorkOS Dashboard
2. Check fetched docs for provider-specific setup (see `/integrations` pages)

### Auto-Linking Behavior

When social auth users sign in after migration:

- WorkOS matches by **email address**
- User is automatically linked to migrated WorkOS account
- No additional migration step required for social auth users

**Trap Warning:** Email verification may be required depending on:
- Your environment's verification settings
- Whether the provider is known to verify emails (e.g., Gmail does, custom domains may not)

Check fetched docs for current email verification behavior by provider.

## Step 6: Migrate Organizations (if using B2B)

### Descope Tenant → WorkOS Organization Mapping

```
For each Descope tenant:
  |
  +-- Map tenant.name --> organization.name
  +-- Map tenant.id   --> organization.external_id
  |
  +-- Call organization.create()
  |
  +-- Store mapping: { descopeTenantId: workosOrgId }
       (needed for membership import)
```

Storing Descope tenant ID as `external_id` maintains a reference during migration.

### Export Tenant Data

Use Descope Management API to retrieve tenants. Check fetched docs for SDK method signature.

## Step 7: Migrate Organization Memberships

### Membership Creation (Decision Tree)

```
For each user-tenant association in Descope:
  |
  +-- Lookup WorkOS user_id (from Step 4 mapping)
  +-- Lookup WorkOS organization_id (from Step 6 mapping)
  |
  +-- Has role in Descope?
  |     |
  |     +-- YES --> Map to WorkOS role slug
  |     |            (create roles in Dashboard first)
  |     |
  |     +-- NO  --> Omit roleSlug parameter
  |
  +-- Call organizationMembership.create()
```

### Role Migration

If using Descope roles:

1. **Before importing memberships:** Create equivalent roles in WorkOS Dashboard
2. Note the `roleSlug` for each role
3. Pass `roleSlug` parameter when creating memberships

Check fetched docs for role and permission setup details.

## Verification Checklist (ALL MUST PASS)

Run these to confirm migration success:

```bash
# 1. Verify WorkOS SDK is importable
node -e "require('@workos-inc/node')" || echo "FAIL: SDK not installed"

# 2. Verify env vars are set
env | grep WORKOS_API_KEY || echo "FAIL: WORKOS_API_KEY missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: WORKOS_CLIENT_ID missing"

# 3. Test user lookup (replace USER_EMAIL)
# Should return migrated user data
curl -X GET "https://api.workos.com/user_management/users?email=USER_EMAIL" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# 4. Test organization lookup (if using B2B)
curl -X GET "https://api.workos.com/organizations" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Manual checks:**
- [ ] Sample user can sign in with password
- [ ] Sample social auth user can sign in with provider
- [ ] Organization memberships visible in Dashboard

## Error Recovery

### "Password import failed" or "Invalid hash format"

**Root cause:** Mismatch between declared `password_hash_type` and actual hash format.

Fix:
1. Verify the algorithm Descope support provided in export
2. Confirm hash string includes algorithm-specific metadata (e.g., bcrypt starts with `$2a$` or `$2b$`)
3. Check fetched docs for exact hash format requirements per algorithm

### "Rate limit exceeded" during import

**Root cause:** Importing users too fast without batching.

Fix:
1. Stop the import script
2. Implement batch processing with delays (e.g., 50 users, then 1-second pause)
3. Resume from last successful user (keep import state)
4. Check fetched docs for current rate limits

### Social auth user not auto-linked

**Root cause:** Email mismatch between Descope export and provider email.

Fix:
1. Verify the email in your WorkOS user record matches the provider's email exactly
2. Check if email verification is blocking the link
3. For non-verified provider emails, user may need to verify in WorkOS first

### "Organization not found" when creating memberships

**Root cause:** Organization ID lookup failed or organization wasn't created.

Fix:
1. Verify organization was created in Step 6 before creating memberships
2. Check your ID mapping structure (Descope tenant ID → WorkOS organization ID)
3. List all organizations via API to confirm existence

### "Invalid role slug"

**Root cause:** Role doesn't exist in WorkOS Dashboard or slug mismatch.

Fix:
1. Go to WorkOS Dashboard → Authorization → Roles
2. Verify role exists and note exact `roleSlug` value
3. Update membership creation to use exact slug (case-sensitive)

## Migration Checklist Summary

```
[ ] Step 3: Users exported from Descope
[ ] Step 3: Password hashes obtained (if needed)
[ ] Step 4: Users imported to WorkOS
[ ] Step 4: Sample user login verified
[ ] Step 5: Social auth providers configured
[ ] Step 5: Social auth user login verified
[ ] Step 6: Organizations created (if using B2B)
[ ] Step 7: Roles created in Dashboard (if using RBAC)
[ ] Step 7: Memberships imported
[ ] Verification: All checklist items pass
```
