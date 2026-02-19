<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or environment for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Stytch Environment (Export Phase)

Check `.env` or environment for:
- `STYTCH_PROJECT_ID` - your Stytch project identifier
- `STYTCH_SECRET` - your Stytch API secret

### SDK Installation

Verify both SDKs are installed:

```bash
# Check Stytch SDK (for export)
npm list stytch 2>/dev/null || echo "MISSING: Install stytch SDK"

# Check WorkOS SDK (for import)
npm list @workos-inc/node 2>/dev/null || echo "MISSING: Install @workos-inc/node SDK"
```

## Step 3: Export Strategy (Decision Tree)

```
What type of users are you migrating?
  |
  +-- B2B (organizations with members)
  |     |
  |     +-- Use Stytch Search Organizations API
  |     +-- Use Stytch Search Members API per org
  |     +-- Continue to Step 4
  |
  +-- Consumer (individual users, no orgs)
        |
        +-- Use Stytch utility: https://github.com/stytchauth/stytch-node-export-users
        +-- STOP: Consumer migration not covered in this guide
```

**This guide covers B2B migration only.** Consumer users require different export tooling.

## Step 4: Export Organizations from Stytch

Use Stytch Search Organizations API to retrieve all organizations.

**Pagination:** Both Organizations and Members APIs support pagination for 1000+ records.

**Rate limit:** 100 requests/minute. Add delays if exporting large datasets.

**Key fields to capture:**
- `organization_id` (Stytch identifier)
- `organization_name` → maps to WorkOS `name`
- `email_allowed_domains` → maps to WorkOS `domainData`
- `organization_slug` (if used for routing)

Save export to JSON file for import phase.

## Step 5: Export Members from Stytch

For each organization, use Stytch Search Members API to retrieve members.

**Member status filtering (IMPORTANT):**
```
Member status?
  |
  +-- "active" --> Export and import directly
  |
  +-- "invited" or "pending" --> Decision:
  |     |
  |     +-- Import as inactive user, then re-invite via WorkOS
  |     +-- OR skip and re-invite fresh via WorkOS
  |
  +-- Other statuses --> Check Stytch docs for meaning
```

**Key fields to capture:**
- `member_id` (Stytch identifier)
- `email_address` → WorkOS `email`
- `email_address_verified` → WorkOS `emailVerified`
- `name` → split into `firstName` + `lastName`
- `organization_id` (for membership linking)
- `status` (for filtering decision)

**Name parsing pattern:**
```
"John Doe Smith" → firstName: "John", lastName: "Doe Smith"
"Alice" → firstName: "Alice", lastName: ""
null/empty → firstName: "", lastName: ""
```

## Step 6: Export Password Hashes (If Using Password Auth)

**STOP. This requires manual intervention.**

Password hashes CANNOT be exported via API. You must:

1. Contact Stytch support: support@stytch.com
2. Request password hash export
3. Wait for manual export (timeline varies - can take days)
4. Verify export format matches Stytch's `scrypt` algorithm

**If Stytch provides hashes in different format:** Check fetched docs for supported hash types (WorkOS supports `scrypt`, `bcrypt`, `argon2`). Confirm export matches before proceeding.

**If you skip this step:** Users will need to reset passwords after migration. Plan for password reset flow.

## Step 7: Import Organizations into WorkOS

Use WorkOS Create Organization API for each exported Stytch organization.

**Field mapping:**
```
Stytch                      → WorkOS
organization_name           → name
email_allowed_domains       → domainData (array of { domain, state })
organization_slug           → custom metadata (optional)
```

**Domain state decision (IMPORTANT):**
```
Should domain be verified on import?
  |
  +-- YES (you own the domain, skip verification)
        → state: "verified"
  |
  +-- NO (user-submitted domain, needs verification)
        → state: "pending"
```

**Verification command:**
```bash
# After import, check organizations exist
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/organizations?limit=10"
```

Expected: JSON array with imported organizations.

## Step 8: Import Users into WorkOS

Use WorkOS Create User API for each exported Stytch member.

**Field mapping:**
```
Stytch                      → WorkOS
email_address               → email
email_address_verified      → emailVerified (boolean)
name (split)                → firstName, lastName
```

**Password import decision tree:**
```
Do you have password hashes from Step 6?
  |
  +-- YES
  |     |
  |     +-- Include in user creation:
  |           passwordHash: "<hash_from_stytch>"
  |           passwordHashType: "scrypt" (or type from export)
  |
  +-- NO
        |
        +-- Omit password fields
        +-- Users will need to reset password or use OAuth/Magic Auth
```

**CRITICAL:** Password hashes must match `passwordHashType`. Mismatched type = authentication failures.

**Verification command:**
```bash
# After import, check users exist
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/users?limit=10"
```

Expected: JSON array with imported users.

## Step 9: Create Organization Memberships

**IMPORTANT:** Users and organizations are separate entities. You must explicitly link them.

Use WorkOS Create Organization Membership API to link each user to their organization(s).

**Field mapping:**
```
Stytch                      → WorkOS
organization_id (Stytch)    → Look up WorkOS organization_id by name/slug
member_id (Stytch)          → Look up WorkOS user_id by email
```

**Lookup pattern:**
1. During org import (Step 7), save mapping: `stytchOrgId → workosOrgId`
2. During user import (Step 8), save mapping: `stytchMemberId → workosUserId`
3. Use mappings to create memberships

**Verification command:**
```bash
# Check memberships exist for an organization
ORG_ID="org_123..." # Replace with actual WorkOS org ID
curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=${ORG_ID}"
```

Expected: JSON array with user memberships.

## Step 10: Authentication Method Configuration

**This is WorkOS Dashboard configuration, not code.**

### Password Authentication

If you imported password hashes:
1. Navigate to WorkOS Dashboard → Authentication
2. Enable "Password" authentication method
3. Configure password strength requirements (optional)

Users can now sign in with existing passwords immediately.

### Magic Auth (Replaces Magic Links + Email OTP)

Stytch magic links and email OTP both map to WorkOS Magic Auth:

**Key differences:**
```
Stytch Magic Links    → Email contains clickable URL
WorkOS Magic Auth     → Email contains 6-digit code (user enters manually)
Stytch Email OTP      → Functionally identical to WorkOS Magic Auth
```

**Code expiration:** 10 minutes (automatic via AuthKit).

To enable:
1. Dashboard → Authentication → Enable "Magic Auth"
2. No application code changes needed for Stytch Email OTP users

### OAuth Providers

If Stytch users sign in via Google, Microsoft, GitHub, etc.:

1. Dashboard → Authentication → OAuth Providers
2. Select provider (Google, Microsoft, GitHub, etc.)
3. Enter OAuth credentials (client ID, secret)
4. Save configuration

**User linking:** WorkOS automatically links OAuth sign-ins to existing users by email match. No manual linking required.

## Verification Checklist (ALL MUST PASS)

Run these commands after completing Steps 7-9:

```bash
# 1. Verify organizations imported
ORG_COUNT=$(curl -s -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/organizations" | jq '.data | length')
echo "Organizations imported: $ORG_COUNT"
[ "$ORG_COUNT" -gt 0 ] || echo "FAIL: No organizations found"

# 2. Verify users imported
USER_COUNT=$(curl -s -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/users" | jq '.data | length')
echo "Users imported: $USER_COUNT"
[ "$USER_COUNT" -gt 0 ] || echo "FAIL: No users found"

# 3. Verify memberships created
MEMBERSHIP_COUNT=$(curl -s -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  "https://api.workos.com/user_management/organization_memberships" | jq '.data | length')
echo "Memberships created: $MEMBERSHIP_COUNT"
[ "$MEMBERSHIP_COUNT" -gt 0 ] || echo "FAIL: No memberships found"

# 4. Test authentication (requires AuthKit integration)
# Navigate to sign-in page and attempt login with migrated user
```

All counts must be > 0. If any fail, revisit corresponding step.

## Error Recovery

### "Rate limit exceeded" during export

**Cause:** Stytch APIs limit to 100 requests/minute.

**Fix:**
```typescript
// Add delay between pagination requests
await new Promise(resolve => setTimeout(resolve, 650)); // 650ms = ~92 req/min
```

### "Organization not found" during membership creation

**Cause:** Membership API received wrong `organization_id` (Stytch ID instead of WorkOS ID).

**Fix:**
1. Check mapping from Step 9: `stytchOrgId → workosOrgId`
2. Verify you're passing WorkOS ID to membership API
3. List organizations to confirm WorkOS ID exists:
   ```bash
   curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     "https://api.workos.com/organizations"
   ```

### "User not found" during membership creation

**Cause:** Membership API received wrong `user_id` (Stytch ID instead of WorkOS ID).

**Fix:**
1. Check mapping from Step 9: `stytchMemberId → workosUserId`
2. Verify you're passing WorkOS ID to membership API
3. List users to confirm WorkOS ID exists:
   ```bash
   curl -H "Authorization: Bearer ${WORKOS_API_KEY}" \
     "https://api.workos.com/user_management/users"
   ```

### "Invalid password hash" during user creation

**Cause:** `passwordHashType` doesn't match actual hash format from Stytch.

**Fix:**
1. Check Stytch export documentation for hash algorithm used
2. Verify WorkOS supports that algorithm (see fetched docs for supported types)
3. If mismatch, contact Stytch support to confirm export format
4. If unsupported format, omit password hashes and trigger password reset flow

### "Duplicate email" during user import

**Cause:** User already exists in WorkOS (partial import or re-run).

**Fix:**
```
Duplicate scenario?
  |
  +-- Intentional re-run (updating data)
  |     |
  |     +-- Use Update User API instead of Create
  |     +-- Look up user_id by email first
  |
  +-- Unintentional (script ran twice)
        |
        +-- Skip existing users (filter by email before creating)
        +-- OR delete test users and re-import fresh
```

### Name parsing produces empty firstName

**Cause:** Stytch `name` field was null or single character.

**Fix:** This is expected for some users. WorkOS accepts empty firstName. Optionally prompt users to complete profile after first sign-in.

### Password authentication not working after import

**Checklist:**
1. Verify password hashes were included in user creation (Step 8)
2. Verify `passwordHashType` matches Stytch export format
3. Verify "Password" authentication enabled in WorkOS Dashboard
4. Test with known-good password from Stytch user
5. Check WorkOS Dashboard logs for auth failure details

If all pass and still failing: hash format mismatch. Re-export from Stytch or trigger password reset.
