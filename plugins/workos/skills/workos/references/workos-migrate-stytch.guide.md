<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Migration Strategy Decision Tree

```
What user data do you need to migrate?
  |
  +-- Organizations + Members + Passwords
  |     |
  |     +-- Contact Stytch support for password hashes (timeline varies)
  |     +-- Export organizations and members via API (see Step 3)
  |     +-- Import into WorkOS (Step 4)
  |
  +-- Organizations + Members only
  |     |
  |     +-- Export via API (Step 3)
  |     +-- Import into WorkOS (Step 4)
  |     +-- Users reset passwords on first login
  |
  +-- Consumer users (not B2B)
        |
        +-- Use Stytch utility: https://github.com/stytchauth/stytch-node-export-users
        +-- Follow Consumer → WorkOS mapping (check fetched docs)
```

**Critical:** Stytch password export requires opening a support ticket. Start this FIRST if passwords are required — it's the bottleneck.

## Step 3: Export from Stytch

### B2B Organizations and Members

Use Stytch Search APIs with pagination:

```javascript
// Export organizations
const allOrgs = [];
let cursor = null;
do {
  const response = await stytchClient.organizations.search({
    limit: 1000,
    cursor,
  });
  allOrgs.push(...response.organizations);
  cursor = response.next_cursor;
} while (cursor);

// For each org, export members
for (const org of allOrgs) {
  const members = await stytchClient.members.search({
    organization_id: org.organization_id,
    limit: 1000,
  });
  org.members = members.members;
}
```

**Rate limit:** 100 requests/minute. For large datasets, add delays between batches.

### Password Hashes (if required)

1. Email Stytch support: support@stytch.com
2. Request password hash export for your project
3. Confirm hash algorithm in export (Stytch uses `scrypt`)
4. Wait for export delivery (timeline varies — check with support)

**Do NOT proceed with password import until hashes are received.**

## Step 4: Import into WorkOS

### Organization Import

Map Stytch organization fields to WorkOS:

```javascript
// Stytch → WorkOS field mapping
const workosOrg = await workos.organizations.createOrganization({
  name: stytchOrg.organization_name,
  domainData: stytchOrg.email_allowed_domains?.map((domain) => ({
    domain,
    state: 'verified', // or 'pending' based on verification status
  })),
});
```

**Save mapping:** Store `stytchOrg.organization_id → workosOrg.id` for member import.

### User Import

Create users with organization membership:

```javascript
const user = await workos.userManagement.createUser({
  email: stytchMember.email_address,
  firstName: stytchMember.name?.split(' ')[0],
  lastName: stytchMember.name?.split(' ').slice(1).join(' '),
  // Use mapped org ID from Step 4
  organizationId: orgIdMap[stytchMember.organization_id],
});
```

### Password Import (if hashes available)

Check fetched docs for WorkOS password import API — algorithm support includes `scrypt`, `bcrypt`, `argon2`.

**Critical:** Verify hash format from Stytch export matches WorkOS requirements before bulk import.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check Stytch export completed
test -f stytch_organizations.json && echo "✓ orgs exported" || echo "✗ missing export"

# 2. Verify WorkOS API key
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid key" || echo "✗ invalid key"

# 3. Check organization import
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | grep -q '"object":"list"' && echo "✓ orgs imported"

# 4. Check user import
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | grep -q '"object":"list"' && echo "✓ users imported"
```

## Error Recovery

### "Rate limit exceeded" during Stytch export

**Root cause:** Exceeding 100 requests/minute limit.

**Fix:** Add delay between batches:

```javascript
if (requestCount % 90 === 0) {
  await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait 1 minute
}
```

### "Domain already exists" during organization import

**Root cause:** Domain claimed by another WorkOS organization.

**Fix:** Check domain ownership in WorkOS Dashboard. Either:

- Remove domain from conflicting org, or
- Import without `domainData`, add domains manually after resolving conflict

### "Invalid hash format" during password import

**Root cause:** Stytch export format doesn't match WorkOS API schema.

**Fix:**

1. Check fetched docs for exact hash format requirements
2. Verify Stytch export includes all required fields (salt, iterations, etc.)
3. Transform export to match WorkOS schema before import
4. Test with ONE user before bulk import

### Missing organization ID during user import

**Root cause:** Organization not yet created in WorkOS, or mapping lost.

**Fix:** Import organizations FIRST, save mapping:

```javascript
const orgMap = {};
for (const stytchOrg of organizations) {
  const workosOrg = await workos.organizations.createOrganization({...});
  orgMap[stytchOrg.organization_id] = workosOrg.id;
}
// Use orgMap during user import
```

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
