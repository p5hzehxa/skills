---
name: workos-migrate-stytch
description: Migrate to WorkOS from Stytch.
---

<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the fetched guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Environment

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** API key has org creation permissions:

```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}' 2>&1 | grep -q "unauthorized" && echo "FAIL: insufficient permissions"
```

### Stytch Access

You need:

- Stytch Project ID (`STYTCH_PROJECT_ID`)
- Stytch Secret (`STYTCH_SECRET`)
- For password migration: support ticket opened with Stytch for hash export

### SDK Installation

Confirm both SDKs present:

```bash
# Check Stytch SDK
npm list stytch || yarn list stytch

# Check WorkOS SDK
npm list @workos-inc/node || yarn list @workos-inc/node
```

Install missing SDKs before proceeding.

## Step 3: User Type Detection (Decision Tree)

```
Stytch project type?
  |
  +-- B2B Organizations --> Use Stytch B2B Search APIs
  |                        (covered by this skill)
  |
  +-- Consumer Users ----> Contact Stytch for export utility
                           (outside scope - see Stytch GitHub)
```

**Critical:** This skill covers B2B org/member migration only. Consumer users require a different export process.

## Step 4: Export Organizations from Stytch

Use Stytch Search Organizations API with pagination.

**Rate limit trap:** 100 requests/minute. Add delays for large datasets.

**Pattern:**

```typescript
// Pseudocode - check fetched docs for exact SDK methods
const allOrgs = [];
let cursor = null;

do {
  const response = await stytchClient.organizations.search({
    cursor: cursor,
    limit: 100
  });
  
  allOrgs.push(...response.organizations);
  cursor = response.next_cursor;
  
  // Rate limit protection
  if (cursor) await sleep(600); // 100/min = ~600ms between requests
} while (cursor);

// Write to staging file
await writeFile('stytch-orgs.json', JSON.stringify(allOrgs, null, 2));
```

**Verify export:**

```bash
# Check file exists and has records
test -f stytch-orgs.json && jq 'length' stytch-orgs.json || echo "FAIL: no orgs exported"
```

## Step 5: Export Members from Stytch

For EACH organization, use Stytch Search Members API with pagination.

**Critical:** Use the same 100/min rate limit logic. For N orgs with M pages each, total time = (N × M × 600ms).

**Pattern:**

```typescript
// Pseudocode
const allMembers = [];

for (const org of organizations) {
  let cursor = null;
  
  do {
    const response = await stytchClient.members.search({
      organization_id: org.organization_id,
      cursor: cursor,
      limit: 100
    });
    
    // Attach org context for later import
    const membersWithOrg = response.members.map(m => ({
      ...m,
      _source_org_id: org.organization_id
    }));
    
    allMembers.push(...membersWithOrg);
    cursor = response.next_cursor;
    
    if (cursor) await sleep(600);
  } while (cursor);
}

await writeFile('stytch-members.json', JSON.stringify(allMembers, null, 2));
```

**Verify export:**

```bash
# Check file exists and has member records
test -f stytch-members.json && jq 'length' stytch-members.json || echo "FAIL: no members exported"
```

## Step 6: Password Hash Export (Decision Tree)

```
Do members use password auth?
  |
  +-- YES --> Open Stytch support ticket for hash export
  |           Wait for hash file delivery (timeline varies)
  |           Verify hash format is 'scrypt' (Stytch default)
  |
  +-- NO  --> Skip to Step 8 (no password import needed)
```

**Critical:** Password export is manual. Timeline is OUTSIDE your control. If migration is time-sensitive, start this ticket FIRST before writing import code.

**Verification when hashes arrive:**

```bash
# Check hash file structure matches expected format
# Exact format TBD from Stytch - confirm with fetched docs
test -f stytch-password-hashes.json && jq 'keys | length' stytch-password-hashes.json
```

## Step 7: Import Organizations into WorkOS

Map Stytch organization schema to WorkOS:

- `organization_name` → `name`
- `email_allowed_domains` → array of `domainData` objects

**Domain state mapping:**

```
Stytch domain verification?
  |
  +-- Verified   --> { domain: "x.com", state: "verified" }
  |
  +-- Unverified --> { domain: "x.com", state: "pending" }
```

**Pattern:**

```typescript
// Pseudocode
const stytchOrgs = JSON.parse(await readFile('stytch-orgs.json'));
const workosOrgMap = new Map(); // stytch_id -> workos_id

for (const stytchOrg of stytchOrgs) {
  const domainData = stytchOrg.email_allowed_domains?.map(domain => ({
    domain: domain,
    state: 'verified' // Or 'pending' based on Stytch verification status
  })) || [];
  
  const workosOrg = await workos.organizations.createOrganization({
    name: stytchOrg.organization_name,
    domainData: domainData
  });
  
  // Store mapping for membership creation
  workosOrgMap.set(stytchOrg.organization_id, workosOrg.id);
}

// Persist mapping for Step 8
await writeFile('org-id-mapping.json', JSON.stringify([...workosOrgMap]));
```

**Verify import:**

```bash
# Check mapping file exists with expected record count
test -f org-id-mapping.json && \
  test $(jq 'length' org-id-mapping.json) -eq $(jq 'length' stytch-orgs.json) || \
  echo "FAIL: org import incomplete"
```

## Step 8: Member Status Filtering (Decision Tree)

```
Stytch member status?
  |
  +-- "active"  --> Import to WorkOS immediately
  |
  +-- "invited" --> Decision:
  |                 - Re-invite via WorkOS invite flow, OR
  |                 - Create user + send re-onboarding email
  |
  +-- "pending" --> Same as invited
  |
  +-- other     --> Skip (archive or handle separately)
```

**Critical:** Do NOT blindly import all statuses. Invited/pending users have not completed onboarding.

Filter pattern:

```typescript
const membersToImport = members.filter(m => m.status === 'active');
const membersToReinvite = members.filter(m => ['invited', 'pending'].includes(m.status));
```

## Step 9: Import Users into WorkOS

Map Stytch member schema to WorkOS user:

- `email_address` → `email`
- `email_address_verified` → `emailVerified` (boolean)
- `name` → split into `firstName` + `lastName`

**Name parsing trap:** Stytch stores full name as single string. Split on first space.

**Pattern with password hashes:**

```typescript
// Load password hashes if available
const passwordHashes = passwordFile ? 
  JSON.parse(await readFile('stytch-password-hashes.json')) : 
  {};

const userIdMap = new Map(); // stytch_member_id -> workos_user_id

for (const member of membersToImport) {
  // Parse name
  const nameParts = member.name?.split(' ') || [];
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';
  
  const userData = {
    email: member.email_address,
    emailVerified: member.email_address_verified,
    firstName: firstName,
    lastName: lastName
  };
  
  // Add password hash if available
  const passwordHash = passwordHashes[member.email_address];
  if (passwordHash) {
    userData.passwordHash = passwordHash;
    userData.passwordHashType = 'scrypt'; // Confirm with Stytch export
  }
  
  const workosUser = await workos.userManagement.createUser(userData);
  userIdMap.set(member.member_id, workosUser.id);
}

await writeFile('user-id-mapping.json', JSON.stringify([...userIdMap]));
```

**Verify import:**

```bash
# Check user mapping exists
test -f user-id-mapping.json && \
  test $(jq 'length' user-id-mapping.json) -eq $(jq 'length' stytch-members.json) || \
  echo "FAIL: user import incomplete"
```

## Step 10: Create Organization Memberships

Link each imported user to their WorkOS organization using stored ID mappings.

**Pattern:**

```typescript
const orgMap = new Map(JSON.parse(await readFile('org-id-mapping.json')));
const userMap = new Map(JSON.parse(await readFile('user-id-mapping.json')));

for (const member of membersToImport) {
  const workosUserId = userMap.get(member.member_id);
  const workosOrgId = orgMap.get(member._source_org_id); // From Step 5
  
  await workos.userManagement.createOrganizationMembership({
    userId: workosUserId,
    organizationId: workosOrgId
  });
}
```

**Verify memberships:**

```bash
# Spot check: pick random user, verify org membership exists
USER_ID=$(jq -r '.[0][1]' user-id-mapping.json)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?user_id=$USER_ID" | \
  jq '.data | length' | grep -q "^[1-9]" || echo "FAIL: no memberships created"
```

## Step 11: Authentication Configuration

### Password Auth (if imported hashes)

Dashboard path: Authentication → Password

1. Enable password authentication
2. Configure password strength requirements (match or exceed Stytch settings)

**Test:** Attempt sign-in with known migrated credentials before notifying users.

### Magic Auth Migration

Stytch "magic link" → WorkOS "Magic Auth" (6-digit codes)

**UX difference:** Users receive CODE via email, not clickable link. Update onboarding docs.

Stytch "email OTP" → WorkOS "Magic Auth" (functionally identical, no changes needed)

Dashboard path: Authentication → Magic Auth → Enable

### OAuth Providers

If Stytch users use social sign-in (Google, GitHub, Microsoft):

1. Dashboard → Authentication → OAuth providers
2. Enable matching providers
3. Configure client ID + secret for each

**Auto-linking:** WorkOS matches users by email. No manual linking needed.

**Verification command:**

```bash
# Check OAuth config via API (example for Google)
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/sso/connections" | \
  jq '.data[] | select(.connection_type == "GoogleOAuth")' || \
  echo "No Google OAuth configured"
```

## Step 12: End-to-End Verification

Run ALL checks before marking migration complete:

```bash
# 1. Org count matches
STYTCH_ORG_COUNT=$(jq 'length' stytch-orgs.json)
WORKOS_ORG_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations?limit=100" | jq '.data | length')
test "$STYTCH_ORG_COUNT" -eq "$WORKOS_ORG_COUNT" || echo "FAIL: org count mismatch"

# 2. User count matches
STYTCH_USER_COUNT=$(jq 'length' stytch-members.json)
WORKOS_USER_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=100" | jq '.data | length')
test "$STYTCH_USER_COUNT" -eq "$WORKOS_USER_COUNT" || echo "FAIL: user count mismatch"

# 3. Test auth flow with sample user
# (manual verification - attempt sign-in via AuthKit)

# 4. Check domain verification status
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/organizations?limit=1" | \
  jq '.data[0].domains' | grep -q "verified" || echo "WARN: no verified domains"
```

**Manual verification required:**

- [ ] Password sign-in works for migrated user
- [ ] Magic Auth delivers codes successfully
- [ ] OAuth sign-in links to correct user account
- [ ] Organization memberships display correctly in dashboard

## Error Recovery

### "unauthorized" during org/user creation

**Root cause:** API key lacks UserManagement permissions.

**Fix:** Dashboard → API Keys → select key → ensure "User Management" scope enabled

### Org import succeeds but user import fails with "organization not found"

**Root cause:** ID mapping file stale or corrupted.

**Fix:** Re-run Step 7 to regenerate `org-id-mapping.json`, then retry Step 9

### Password sign-in fails after hash import

**Root causes:**

1. `passwordHashType` mismatch (confirm Stytch uses `scrypt`)
2. Hash corruption during export/import
3. Email case mismatch (Stytch: `User@example.com`, WorkOS: `user@example.com`)

**Fix:**

```bash
# Check hash type in import logs
grep "passwordHashType" import.log | head -1

# Verify email normalization
jq '.[] | .email' stytch-members.json | grep "[A-Z]" && echo "WARN: mixed case emails"
```

Normalize emails to lowercase before import if case mismatch detected.

### Rate limit errors during export (429 from Stytch)

**Root cause:** Exceeded 100 requests/minute.

**Fix:** Increase sleep duration between paginated requests from 600ms to 1000ms. Stytch does not support burst credits.

### Members missing after import

**Root cause:** Status filtering too aggressive (Step 8).

**Fix:** Review filtered-out members:

```typescript
const skippedMembers = members.filter(m => m.status !== 'active');
console.log('Skipped statuses:', skippedMembers.map(m => m.status));
```

Decide whether to import "invited" members retroactively.

### OAuth sign-in creates duplicate user instead of linking

**Root cause:** Email mismatch between OAuth profile and imported user.

**Fix:** Check OAuth provider returns verified email:

```bash
# Test OAuth flow, inspect returned email claim
# Dashboard → Authentication → OAuth → Test connection
```

Ensure imported user `emailVerified: true` to enable auto-linking.

## Related Skills

- workos-authkit-nextjs - Integrate AuthKit after migration
- workos-authkit-react - Add client-side auth UI post-migration
