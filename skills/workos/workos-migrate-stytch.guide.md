<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required credentials:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `STYTCH_PROJECT_ID` - for export phase
- `STYTCH_SECRET` - for export phase

### SDK Installation

Verify both SDKs are installed:

```bash
# Check Stytch SDK (for export phase)
npm list stytch 2>/dev/null || echo "MISSING: stytch package"

# Check WorkOS SDK (for import phase)
npm list @workos-inc/node 2>/dev/null || echo "MISSING: @workos-inc/node package"
```

Install missing packages before proceeding.

## Step 3: Migration Type Decision Tree

```
What are you migrating?
  |
  +-- B2B Users (Organizations + Members) --> Follow B2B path
  |                                            - Organizations FIRST
  |                                            - Then Members + Memberships
  |
  +-- Consumer Users (individual accounts) --> Use Stytch utility
                                                https://github.com/stytchauth/stytch-node-export-users
                                                Then import as WorkOS users (no org memberships)
```

**This skill covers B2B migration only.** For Consumer Users, use the Stytch utility linked above.

## Step 4: Export Organizations from Stytch

### Rate Limit Awareness

Stytch APIs have a 100 requests/minute limit. For large datasets, implement delays between batches.

### Export Pattern

Use Stytch Search Organizations API with pagination:

```typescript
// Pseudocode pattern - check fetched docs for exact SDK methods
async function exportAllOrganizations() {
  const allOrgs = [];
  let cursor = null;
  
  do {
    const response = await stytchClient.organizations.search({
      cursor,
      limit: 1000  // Max per request
    });
    
    allOrgs.push(...response.organizations);
    cursor = response.next_cursor;
    
    // Rate limit protection
    if (cursor) await delay(600); // ~100/min
  } while (cursor);
  
  return allOrgs;
}
```

**Save to file** — you'll need this data for Step 6.

### Data Structure to Capture

For each organization, record:
- `organization_id` (Stytch ID)
- `organization_name` (maps to WorkOS `name`)
- `email_allowed_domains` (maps to WorkOS `domainData`)

## Step 5: Export Members from Stytch

### Export Pattern

For EACH organization from Step 4, fetch its members:

```typescript
// Pseudocode pattern
async function exportMembersForOrg(orgId: string) {
  const allMembers = [];
  let cursor = null;
  
  do {
    const response = await stytchClient.organizations.members.search({
      organization_id: orgId,
      cursor,
      limit: 1000
    });
    
    allMembers.push(...response.members);
    cursor = response.next_cursor;
    
    if (cursor) await delay(600); // Rate limit protection
  } while (cursor);
  
  return allMembers;
}
```

**Save to file with organization mapping** — link each member to their org ID.

### Data Structure to Capture

For each member:
- `member_id` (Stytch ID)
- `organization_id` (parent org)
- `email_address`
- `name` (will split into first/last)
- `status` (active, invited, pending)
- `email_address_verified` (boolean)

### Status Filtering Decision Tree

```
Member status?
  |
  +-- "active" --> Import immediately
  |
  +-- "invited" or "pending" --> Decision:
                                  - Skip and re-invite in WorkOS, OR
                                  - Import as unverified users
```

**Recommendation:** Only import `active` members. Re-invite others through WorkOS invitation flow.

## Step 6: Password Hash Export (IF NEEDED)

```
Do your users sign in with passwords?
  |
  +-- YES --> Contact Stytch support (support@stytch.com)
  |           Request password hash export
  |           Timeline: Variable (days to weeks)
  |
  +-- NO  --> Skip to Step 7
```

### When You Receive Hashes

**Verify hash format** before importing:
- Stytch uses `scrypt` by default
- WorkOS supports: `scrypt`, `bcrypt`, `argon2`, `pbkdf2`, `md5`, `sha256`
- If format doesn't match, contact WorkOS support

**Link hashes to members** — ensure each hash maps to correct `email_address`.

## Step 7: Import Organizations into WorkOS

### Import Order (CRITICAL)

```
1. Organizations FIRST
2. Then Users
3. Then Organization Memberships

NEVER reverse this order. Users need org IDs. Memberships need both.
```

### Import Pattern

```typescript
// Pseudocode pattern
async function importOrganization(stytchOrg) {
  const domainData = stytchOrg.email_allowed_domains?.map(domain => ({
    domain,
    state: 'verified'  // Or 'pending' - check org email verification status
  }));
  
  const org = await workos.organizations.createOrganization({
    name: stytchOrg.organization_name,
    domainData: domainData || []
  });
  
  // CRITICAL: Save mapping for Step 8
  // stytchOrgId -> workosOrgId
  return { stytchId: stytchOrg.organization_id, workosId: org.id };
}
```

**Save ID mappings** — you'll need them in Step 8.

### Domain State Decision

```
Was email domain verified in Stytch?
  |
  +-- YES --> state: 'verified'
  |
  +-- NO  --> state: 'pending'
```

Check fetched docs for domain verification workflows if needed.

## Step 8: Import Users into WorkOS

### Name Parsing Pattern

Stytch stores full names. WorkOS requires first/last split:

```typescript
// Pseudocode pattern
function parseName(fullName: string) {
  const parts = fullName?.trim().split(' ') || [];
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}
```

### Import Pattern (Without Passwords)

```typescript
// Pseudocode pattern
async function importUser(stytchMember) {
  const { firstName, lastName } = parseName(stytchMember.name);
  
  const user = await workos.userManagement.createUser({
    email: stytchMember.email_address,
    emailVerified: stytchMember.email_address_verified,
    firstName,
    lastName
  });
  
  // CRITICAL: Save mapping for Step 9
  return { stytchId: stytchMember.member_id, workosId: user.id };
}
```

### Import Pattern (With Passwords)

If you have password hashes from Step 6:

```typescript
// Pseudocode pattern - add these fields
await workos.userManagement.createUser({
  email: stytchMember.email_address,
  emailVerified: stytchMember.email_address_verified,
  firstName,
  lastName,
  passwordHash: stytchPasswordHash,      // From support export
  passwordHashType: 'scrypt'             // Or 'bcrypt', 'argon2', etc.
});
```

**Critical:** Match `passwordHashType` to actual hash algorithm from Stytch export. Mismatch will break authentication.

### Email Verification State

Preserve `email_address_verified` from Stytch — users should not need to re-verify emails they already verified.

**Save user ID mappings** — needed for Step 9.

## Step 9: Create Organization Memberships

### Linking Pattern

Use the ID mappings from Steps 7 and 8:

```typescript
// Pseudocode pattern
async function createMembership(stytchMember, orgMapping, userMapping) {
  const workosOrgId = orgMapping[stytchMember.organization_id];
  const workosUserId = userMapping[stytchMember.member_id];
  
  await workos.userManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId,
    roleSlug: 'member'  // Or map from Stytch role data if available
  });
}
```

### Role Mapping Decision Tree

```
Does Stytch member have role data?
  |
  +-- YES --> Map to WorkOS role slugs
  |           Check fetched docs for role configuration
  |
  +-- NO  --> Default to 'member' role
              Assign admin roles manually post-migration
```

**Role slug note:** WorkOS role slugs are configured in Dashboard under Roles & Permissions. Ensure target roles exist before assignment.

## Step 10: Authentication Method Configuration

### Dashboard Configuration (REQUIRED)

Navigate to WorkOS Dashboard:

```
Authentication tab
  |
  +-- Password Authentication
  |     - Enable toggle
  |     - Configure strength requirements
  |
  +-- Magic Auth (replaces Stytch Magic Links)
  |     - Enable toggle
  |     - Codes valid for 10 minutes
  |     - Auto-validated by AuthKit
  |
  +-- OAuth Providers (if used in Stytch)
        - Select providers: Google, Microsoft, GitHub, etc.
        - Configure OAuth credentials
        - Email matching links existing users
```

### Authentication Method Migration Map

| Stytch Method | WorkOS Equivalent | Migration Notes |
|---------------|-------------------|-----------------|
| Email + Password | Password Authentication | Import hashes from Step 6 |
| Magic Links | Magic Auth | Links → 6-digit codes (behavioral change) |
| Email OTP | Magic Auth | Direct replacement, no logic changes |
| OAuth (Google, etc.) | OAuth Providers | Email-based auto-linking |

### Magic Auth Behavioral Change (IMPORTANT)

**Stytch:** Sends clickable link in email
**WorkOS:** Sends 6-digit code, user enters manually

**User impact:** Slightly different UX, but functionally equivalent. Consider user communication if users expect clickable links.

## Verification Checklist (ALL MUST PASS)

Run these commands to verify migration success:

```bash
# 1. Verify organization count matches
echo "Stytch orgs: $(cat stytch_orgs.json | jq 'length')"
# Compare to WorkOS Dashboard org count

# 2. Verify user count matches (accounting for status filters)
echo "Stytch active members: $(cat stytch_members.json | jq '[.[] | select(.status == "active")] | length')"
# Compare to WorkOS Dashboard user count

# 3. Test password authentication (if migrated)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "existing_password", "client_id": "'$WORKOS_CLIENT_ID'"}'
# Should return 200 with session token

# 4. Test Magic Auth flow
# Send code via Dashboard "Test Authentication" feature
# Verify code delivery and validation

# 5. Verify OAuth provider configuration
# Check Dashboard > Authentication > OAuth shows green checkmarks

# 6. Test user-org linking
# Pick random user ID, verify membership via:
curl https://api.workos.com/user_management/organization_memberships?user_id=USER_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Do not mark migration complete until all checks pass.**

## Error Recovery

### "User already exists" during import

**Root cause:** Attempting to re-run import without deduplication.

**Fix:**
1. Before creating user, check if email exists:
   ```typescript
   const existing = await workos.userManagement.listUsers({ email });
   if (existing.data.length > 0) {
     // Use existing user ID instead of creating
   }
   ```
2. Or use idempotency: track imported Stytch IDs in local database/file

### "Organization not found" during membership creation

**Root cause:** Organization import failed or ID mapping is incorrect.

**Fix:**
1. Verify organization exists:
   ```bash
   curl https://api.workos.com/organizations/ORG_ID \
     -H "Authorization: Bearer $WORKOS_API_KEY"
   ```
2. Re-run Step 7 if organization missing
3. Check ID mapping file for corruption

### "Invalid password hash" during user creation

**Root cause:** Mismatch between `passwordHashType` and actual hash format.

**Fix:**
1. Verify hash format with Stytch support
2. Check fetched docs for supported hash types
3. Ensure `passwordHashType` parameter exactly matches algorithm name
4. Test with single user before batch import

### Rate limit errors (429) from Stytch

**Root cause:** Exceeded 100 requests/minute during export.

**Fix:**
1. Add delay between batches:
   ```typescript
   await new Promise(resolve => setTimeout(resolve, 600)); // 600ms = ~100/min
   ```
2. Implement exponential backoff for retries
3. For very large exports, consider running overnight

### Users cannot sign in after migration

**Decision tree:**
```
Authentication failure?
  |
  +-- Password auth fails --> Check:
  |                           - Password hash imported correctly?
  |                           - passwordHashType matches algorithm?
  |                           - User emailVerified = true?
  |
  +-- Magic Auth fails -----> Check:
  |                           - Magic Auth enabled in Dashboard?
  |                           - Email delivery configured?
  |                           - Code not expired (10min)?
  |
  +-- OAuth fails ----------> Check:
                              - Provider configured in Dashboard?
                              - OAuth credentials valid?
                              - Redirect URI matches app config?
```

### "Invalid role slug" during membership creation

**Root cause:** Role does not exist in WorkOS Dashboard.

**Fix:**
1. Navigate to Dashboard > Roles & Permissions
2. Create role with exact slug name used in code
3. Or use default role 'member' and assign custom roles manually post-migration

## Post-Migration Tasks

After verification passes:

1. **Sunset Stytch integration** — remove Stytch SDK and credentials from production
2. **User communication** — notify users of authentication changes (especially Magic Auth → code-based flow)
3. **Monitor auth metrics** — watch for failed login attempts indicating migration issues
4. **Backup ID mappings** — save Stytch→WorkOS ID mappings for debugging
5. **Update documentation** — reflect new WorkOS auth flows in internal docs

## Related Skills

After migration completes, integrate WorkOS authentication:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-react-router
