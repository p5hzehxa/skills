<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### API Keys

Confirm environment variables exist:

- `STYTCH_PROJECT_ID` - source system
- `STYTCH_SECRET` - source system
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Detect package manager, verify both SDKs installed:

```bash
# Check source SDK
npm list stytch

# Check destination SDK
npm list @workos-inc/node
```

**Verify:** Both packages exist in node_modules before continuing.

## Step 3: Password Hash Export (BLOCKING for password-based auth)

**Decision tree:**

```
Does your Stytch project use password authentication?
  |
  +-- Yes --> STOP. Email support@stytch.com NOW
  |           Request: "Password hash export for WorkOS migration"
  |           Wait for: CSV/JSON file with hashes
  |           Timeline: Variable (days to weeks)
  |
  +-- No  --> Skip to Step 4
```

**CRITICAL:** Stytch does NOT provide self-service password exports. You MUST contact support. Do not attempt to export passwords via API — they are not exposed.

**What to request:** Specify you need password hashes in a format compatible with WorkOS. Stytch uses `scrypt` — verify the export includes algorithm parameters (N, r, p values).

**Trap warning:** If you skip this step and have password users, they will ALL need password resets. This creates bad UX and support load.

## Step 4: Export Organizations

Use Stytch Search Organizations API (B2B only):

```bash
# Verify API access before writing export script
curl -X POST https://test.stytch.com/v1/b2b/organizations/search \
  -u "project_id:secret" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

**Rate limit:** 100 requests/minute. For >1000 orgs, implement pagination with `cursor` parameter.

**Consumer users:** For non-B2B Stytch projects, use [stytch-node-export-users](https://github.com/stytchauth/stytch-node-export-users) utility instead.

**Export pattern:**

1. Fetch all organizations with pagination
2. For each org, fetch members via Search Members API
3. Store as JSON: `[{org, members: [...]}]`

## Step 5: Import Organizations

Use WorkOS Create Organization API.

**Field mapping:**

```
Stytch field             --> WorkOS field
organization_name        --> name
email_allowed_domains[]  --> domainData[].domain
                         --> domainData[].state ("verified" or "pending")
```

**Domain state decision:**

```
Are Stytch domains verified in their dashboard?
  |
  +-- Yes --> state: "verified"
  |
  +-- No  --> state: "pending"
  |
  +-- Unknown --> state: "pending" (safer default)
```

**Verification after import:**

```bash
# List organizations to confirm import
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Check: Organization count matches Stytch export count.

## Step 6: Filter Members by Status

**Decision tree for member import:**

```
Member status in Stytch export?
  |
  +-- "active"   --> Import to WorkOS
  |
  +-- "invited"  --> Skip import, re-invite via WorkOS
  |
  +-- "pending"  --> Skip import, re-invite via WorkOS
  |
  +-- other      --> Skip (do not import inactive/deleted)
```

**Trap warning:** Importing non-active members creates orphaned accounts. Instead, use WorkOS invite flow to re-create pending invitations.

## Step 7: Import Users

Use WorkOS Create User API.

**Field mapping:**

```
Stytch field              --> WorkOS field
email_address             --> email
email_address_verified    --> emailVerified
name (split on space)     --> firstName, lastName
```

**Name parsing edge case:**

```
name value               --> firstName, lastName
"John Doe"               --> "John", "Doe"
"John"                   --> "John", ""
"Mary Jane Smith"        --> "Mary", "Jane Smith"
null/undefined           --> "", ""
```

**Password hash import (if Step 3 completed):**

```typescript
// Pseudocode - check docs for exact SDK method
createUser({
  email: stytchMember.email,
  emailVerified: stytchMember.email_verified,
  firstName: parsedFirstName,
  lastName: parsedLastName,
  passwordHash: hashFromStytchExport,
  passwordHashType: 'scrypt' // or 'bcrypt', 'argon2' - verify with Stytch support
})
```

**CRITICAL:** `passwordHashType` MUST match the algorithm Stytch used. Do NOT assume — confirm with support export documentation.

## Step 8: Create Organization Memberships

After each user import, link to their organization(s).

Use WorkOS Create Organization Membership API with:

- `userId` from Step 7 response
- `organizationId` from Step 5 response

**Multi-organization users:** If a Stytch member belongs to multiple orgs, create ONE membership per org.

**Verification after import:**

```bash
# Check user count in organization
curl https://api.workos.com/user_management/organization_memberships \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "organization_id=org_123"
```

Check: Membership count matches filtered member count from Step 6.

## Step 9: Authentication Method Configuration

**Dashboard navigation:**

1. Go to Authentication tab
2. Enable authentication methods based on Stytch usage

**Method migration mapping:**

```
Stytch method           --> WorkOS equivalent
Email + Password        --> Password authentication (enable in dashboard)
Magic Link (clickable)  --> Magic Auth (6-digit code via email)
Email OTP               --> Magic Auth (same behavior)
OAuth (Google, etc.)    --> OAuth (configure same providers in dashboard)
```

**CRITICAL difference - Magic Link vs Magic Auth:**

- Stytch: Sends clickable link in email
- WorkOS: Sends 6-digit code, user types it in
- **This is a UX change** - users will notice the difference
- **Code expiry:** 10 minutes (vs Stytch's configurable expiry)

**OAuth provider setup (if used):**

Check fetched docs for exact configuration steps. General pattern:

1. Navigate to Authentication > OAuth providers
2. Select provider (Google, Microsoft, GitHub, etc.)
3. Enter OAuth client credentials
4. Enable provider

**Auto-linking:** WorkOS automatically links OAuth sign-ins to existing users by email match. No code changes needed.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Verify organization count matches
STYTCH_COUNT=$(cat stytch_export.json | jq '.organizations | length')
WORKOS_COUNT=$(curl -s https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" | jq '.data | length')
[ "$STYTCH_COUNT" -eq "$WORKOS_COUNT" ] || echo "FAIL: Org count mismatch"

# 2. Verify at least one user imported
curl -s https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.data | length' | grep -v '^0$' || echo "FAIL: No users imported"

# 3. Test password authentication (if passwords imported)
# Attempt sign-in with known test credentials
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"<test_password>"}' \
  | jq .success || echo "FAIL: Password auth not working"

# 4. Verify authentication methods enabled in dashboard
# Manual check: Dashboard > Authentication > enabled methods match Stytch usage
```

## Error Recovery

### "Rate limit exceeded" during export

**Cause:** Stytch limits to 100 requests/minute.

**Fix:**

1. Add delay between API calls: `await sleep(600)` (600ms = ~100/min)
2. Implement exponential backoff for 429 responses
3. For large exports, run overnight or split into batches

### "Password authentication not working" after import

**Root causes (check in order):**

1. **Wrong hash algorithm** - Verify `passwordHashType` matches Stytch's algorithm
2. **Missing hash parameters** - scrypt needs N, r, p values (contact Stytch support)
3. **Authentication not enabled** - Check Dashboard > Authentication > Password is ON
4. **Hash format mismatch** - Stytch support may have sent non-standard format

**Verification:**

```bash
# Check if password field exists on user
curl https://api.workos.com/user_management/users/user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.password_hash' # Should NOT be null
```

### "User already exists" during import

**Cause:** Email collision - user already created in WorkOS or duplicate in Stytch export.

**Fix:**

1. Skip create, fetch existing user by email
2. Update user with missing fields (firstName, lastName, etc.)
3. Create organization membership if missing

**Pattern:**

```
Attempt createUser
  |
  +-- 409 Conflict --> getUserByEmail --> updateUser --> createMembership
  |
  +-- 200 Success  --> createMembership
```

### "Organization not found" when creating membership

**Cause:** Organization ID from Step 5 not available (import failed or out of order).

**Fix:**

1. Verify Step 5 completed successfully
2. Check organization ID is from WorkOS response, not Stytch ID
3. Re-run organization import if needed

**Never use Stytch organization IDs in WorkOS API calls.**

### "Invalid domain state" during org import

**Cause:** `domainData.state` must be "verified" or "pending" — no other values.

**Fix:** Replace any other value with "pending" (safer default).

### Members imported but can't sign in

**Checklist:**

1. `emailVerified` set to true? (false = user can't sign in)
2. Password hash imported correctly? (if password auth)
3. OAuth provider configured? (if OAuth users)
4. Organization membership created? (required for multi-tenant)

**Verification:**

```bash
# Check user's email verified status
curl https://api.workos.com/user_management/users/user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | jq '.email_verified'
```

If false and user should be verified, update user:

```bash
curl -X PUT https://api.workos.com/user_management/users/user_123 \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d '{"email_verified": true}'
```

### Magic Link users complain about new UX

**This is expected** - Magic Auth uses 6-digit codes instead of clickable links.

**Communication template:**

> "We've upgraded authentication. Instead of clicking a link, you'll now enter a 6-digit code from your email. Codes expire in 10 minutes."

**No fix available** - this is an architectural difference between Stytch and WorkOS.

## Related Skills

After migration completes, integrate AuthKit for authentication UI:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
