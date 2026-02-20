<!-- refined:sha256:52a3356a17a8 -->

# WorkOS Migration: Descope

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/descope`

The fetched docs are the source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Confirm WorkOS SDK is installed and importable in your project.

**Verify:** Run SDK import before writing migration code.

## Step 3: Password Export Strategy (Decision Tree)

```
Do users sign in with passwords?
  |
  +-- No --> Skip to Step 4 (social auth only)
  |
  +-- Yes --> Contact Descope support for password export
              |
              +-- Descope provides CSV with hashes
              |
              +-- Note hash algorithm (bcrypt/argon2/pbkdf2)
              |
              +-- WorkOS supports: bcrypt, argon2, pbkdf2
```

**CRITICAL:** Descope does NOT expose password hashes via API. You MUST open a support ticket.

**Trap warning:** Do not attempt to extract passwords from Descope Backend APIs — they are not available there.

## Step 4: Export User Data

Use Descope Management API to export user records.

**Field mapping for Create User API:**

| Descope Export Field | WorkOS API Parameter |
| -------------------- | -------------------- |
| `email`              | `email`              |
| `givenName`          | `first_name`         |
| `familyName`         | `last_name`          |
| `verifiedEmail`      | `email_verified`     |

**Important:** Track which users have tenant associations for Step 6.

## Step 5: Import Users with Passwords

Use `userManagement.createUser()` with password hash parameters.

**Password import parameters:**

- `password_hash_type` - set to algorithm from Descope export (bcrypt/argon2/pbkdf2)
- `password_hash` - set to hash value from export

**Rate limit handling:** Check fetched docs for current rate limits. For large migrations, implement batching with delays between requests.

**Verification:** After import batch completes, test sign-in with a sample user using password auth.

## Step 6: Organization Migration (Decision Tree)

```
Do you use Descope Tenants?
  |
  +-- No --> Skip to Step 7 (users only)
  |
  +-- Yes --> Export tenants via Descope Management API
              |
              +-- Map tenant fields to WorkOS Organizations
              |
              +-- Create Organizations using organizations.createOrganization()
              |
              +-- Store Descope tenant ID as external_id (critical for references)
```

**Organization field mapping:**

| Descope Tenant | WorkOS Organization |
| -------------- | ------------------- |
| `name`         | `name`              |
| `id`           | `external_id`       |

**Why external_id matters:** Preserves reference between systems during migration — use it to look up Organizations when creating memberships.

## Step 7: Organization Memberships

### User-Tenant Association

From Descope user export, extract tenant associations. Create memberships using `userManagement.createOrganizationMembership()`.

**Parameters:**

- `userId` - WorkOS user ID (from Step 5 import)
- `organizationId` - WorkOS organization ID (from Step 6)
- `roleSlug` - (optional) map from Descope roles

### RBAC Migration

```
Do you use Descope roles?
  |
  +-- No --> Create memberships without roleSlug
  |
  +-- Yes --> 1. Create equivalent roles in WorkOS Dashboard
              2. Map Descope role names to WorkOS role slugs
              3. Include roleSlug when creating memberships
```

**Role setup location:** WorkOS Dashboard → Environment → Authorization → Roles

**Trap warning:** Create roles in Dashboard BEFORE creating memberships — API will reject invalid roleSlug values.

## Step 8: Social Auth Provider Configuration

```
Do users sign in with Google/Microsoft/other OAuth?
  |
  +-- No --> Skip to Step 9
  |
  +-- Yes --> Configure provider client credentials in WorkOS Dashboard
              |
              +-- Navigate to Integrations page
              |
              +-- Add provider credentials
              |
              +-- Users auto-link on first sign-in via EMAIL MATCH
```

**Email verification behavior:**

- Trusted providers (gmail.com via Google OAuth) - no verification step
- Untrusted providers - user may need to verify email if verification enabled

Check fetched docs for complete list of trusted domains.

**Trap warning:** WorkOS matches users by email address — ensure Descope emails are accurate before social auth migration.

## Step 9: Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration:

```bash
# 1. Check environment variables exist
env | grep "WORKOS_API_KEY\|WORKOS_CLIENT_ID"

# 2. Verify user import succeeded (replace COUNT with expected total)
# Use SDK or Dashboard to check user count

# 3. Test password auth for sample user
# Attempt sign-in via WorkOS AuthKit with migrated credentials

# 4. Test social auth for sample user
# Attempt sign-in via configured OAuth provider

# 5. Verify organization memberships
# Use SDK to list memberships for sample organization
```

## Error Recovery

### "Password import failed with 400 Bad Request"

**Most common causes:**

1. `password_hash_type` doesn't match actual hash algorithm
   - Fix: Verify with Descope support which algorithm was used
2. Hash format is malformed or incomplete
   - Fix: Check CSV export has complete hash strings (no truncation)
3. Unsupported hash algorithm
   - Fix: Confirm algorithm is bcrypt/argon2/pbkdf2 — WorkOS doesn't support others

### "Rate limit exceeded (429)"

**Root cause:** Too many Create User API calls without delays.

**Fix:** Implement batching with sleep between batches. Check fetched docs for current rate limits and adjust batch size accordingly.

### "User not found after social auth sign-in"

**Most common causes:**

1. Email address mismatch between Descope export and OAuth provider
   - Fix: Verify user's email in Descope matches their provider email
2. User wasn't imported yet
   - Fix: Complete Step 5 before testing social auth
3. Email verification required but not completed
   - Fix: Check Dashboard authentication settings — may need to disable email verification during migration

### "Organization membership creation failed"

**Most common causes:**

1. Invalid `roleSlug` - role doesn't exist in WorkOS
   - Fix: Create role in Dashboard first (Step 7)
2. Organization not created yet
   - Fix: Complete Step 6 before creating memberships
3. User ID or Organization ID is wrong
   - Fix: Verify IDs from import results — use `external_id` to look up Organizations

### "SDK import error"

- Check: SDK package installed in node_modules or equivalent
- Check: Import path matches SDK version in fetched docs

### "API key authentication failed"

- Check: `WORKOS_API_KEY` starts with `sk_` prefix
- Check: Key has User Management permissions in Dashboard

## Migration Sequence Summary

**CRITICAL:** Follow this order to avoid dependency failures:

1. Export passwords from Descope support (if using passwords)
2. Export users from Descope Management API
3. Import users into WorkOS (with passwords if available)
4. Export tenants from Descope Management API (if using multi-tenant)
5. Create Organizations in WorkOS
6. Create roles in WorkOS Dashboard (if using RBAC)
7. Create organization memberships
8. Configure social auth providers (if using OAuth)
9. Test sample users for each auth method

**Trap warning:** Creating memberships before Organizations or roles will fail. Follow sequence exactly.
