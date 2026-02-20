<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`
- `STYTCH_PROJECT_ID` - for export phase
- `STYTCH_SECRET` - for export phase

### SDK Installation

Verify both SDKs are installed (you need Stytch SDK for export, WorkOS SDK for import):

```bash
# Check package.json or equivalent for both SDKs
grep -E "stytch|@workos-inc" package.json
```

## Step 3: Export Strategy (Decision Tree)

```
User type?
  |
  +-- B2B Users --> Use Stytch Search Organizations + Search Members APIs
  |                 (covered in this guide)
  |
  +-- Consumer Users --> Use Stytch utility:
                         https://github.com/stytchauth/stytch-node-export-users
```

For B2B exports, rate limit is 100 requests/minute. For projects with >1000 records, pagination is automatic.

## Step 4: Export Organizations and Members

Use Stytch APIs to export:

1. **Organizations** - Search Organizations API returns all orgs
2. **Members** - For each org, Search Members API returns all members

**Filter decision:**

```
Member status?
  |
  +-- active   --> Export and import
  |
  +-- invited  --> Decide: import as unverified OR re-send WorkOS invite
  |
  +-- pending  --> Decide: import as unverified OR re-send WorkOS invite
```

Save exports to JSON files for import phase.

## Step 5: Export Passwords (CRITICAL)

**Stytch does NOT provide self-service password export.** You must contact Stytch support at support@stytch.com.

Timeline: Varies (typically days to weeks).

**When you receive the export:**

1. Verify hash algorithm (Stytch uses `scrypt` by default)
2. Confirm format matches WorkOS expectations
3. Check if hashes include salt/parameters (required for import)

**Supported algorithms:** `scrypt`, `bcrypt`, `argon2`

**Trap warning:** Do NOT assume hash format. Stytch may provide hashes in different formats depending on migration timeline. Always verify with Stytch support.

## Step 6: Import Order (MUST FOLLOW)

```
1. Organizations  --> workos.organizations.create()
2. Users          --> workos.userManagement.createUser()
3. Memberships    --> workos.userManagement.createOrganizationMembership()
```

**Why this order:** User creation requires email; membership creation requires both user ID and organization ID.

## Step 7: Map Organization Data

**Field mapping:**

```
Stytch field              --> WorkOS field
organization_name         --> name
email_allowed_domains[]   --> domainData[] with domain + state
```

**Domain state decision:**

```
Domain verification status?
  |
  +-- Verified in Stytch   --> state: "verified"
  |
  +-- Not verified         --> state: "pending"
```

Check fetched docs for exact `domainData` structure.

## Step 8: Map User Data

**Field mapping:**

```
Stytch field                --> WorkOS field
email_address               --> email
email_address_verified      --> emailVerified
name (split on space)       --> firstName, lastName
```

**Name parsing trap:** If `name` is a single word, assign to `firstName` and leave `lastName` empty. Do NOT use placeholder values like "N/A".

## Step 9: Import Passwords (If Available)

**During user creation OR via update:**

Pass two required fields:

1. `passwordHash` - the hash string from Stytch export
2. `passwordHashType` - the algorithm (e.g., `'scrypt'`, `'bcrypt'`)

**Critical:** Hash must include all parameters (salt, cost, etc.). If Stytch export lacks these, users CANNOT sign in without password reset.

**Verification after import:**

Attempt sign-in with a test user's known password. If sign-in fails, hash import failed.

## Step 10: Authentication Method Mapping

### Password Authentication

- Enable in Dashboard > Authentication > Password
- Users sign in with existing credentials immediately (if hashes imported)

### Magic Links (Stytch) → Magic Auth (WorkOS)

**Behavior change:** Stytch sends clickable links; WorkOS sends 6-digit codes.

**User impact:** Users must enter code manually instead of clicking link.

**Code lifetime:** 10 minutes (check fetched docs if this changes).

**No code changes needed** if you were using Stytch email OTP (functionally identical).

### OAuth Providers

**Stytch provider → WorkOS provider (1:1 mapping):**

```
Google    --> Google
Microsoft --> Microsoft
GitHub    --> GitHub
```

**User linking:** Automatic via email match. If user signs in with Google and email matches imported user, WorkOS links them.

**Dashboard setup:** Authentication > OAuth providers > Select provider > Configure client ID/secret.

**Trap warning:** If a Stytch user has ONLY OAuth (no password), you must configure that OAuth provider in WorkOS BEFORE user can sign in. Otherwise they're locked out.

## Verification Checklist (ALL MUST PASS)

Run these checks after import:

```bash
# 1. Verify orgs imported
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'

# 2. Verify users imported
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users | jq '.data | length'

# 3. Test password sign-in (if hashes imported)
# Use AuthKit sign-in flow with test user credentials
# Expected: Successful sign-in without password reset

# 4. Verify memberships
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=org_123" \
  | jq '.data | length'
```

**If check #3 fails:** Password hashes were not imported correctly. Verify hash format with Stytch support and re-import.

## Error Recovery

### "Invalid password hash format"

**Most common cause:** Hash missing salt or algorithm parameters.

Fix:

1. Contact Stytch support to confirm export includes complete hash with parameters
2. Verify `passwordHashType` matches Stytch's algorithm (likely `'scrypt'`)
3. Check fetched docs for exact hash format requirements

### Users cannot sign in after import

**Decision tree:**

```
Sign-in method?
  |
  +-- Password --> Check: Was passwordHash imported? If no, user must reset password
  |
  +-- OAuth    --> Check: Is provider configured in Dashboard? If no, configure it
  |
  +-- Magic Auth --> Check: Is Magic Auth enabled in Dashboard? If no, enable it
```

### Rate limit errors during export (429)

Stytch limit: 100 requests/minute.

Fix: Add delay between batch requests:

```bash
# Wait 0.6 seconds per request = ~100 requests/minute
sleep 0.6
```

### "Organization not found" during membership creation

**Root cause:** Organization wasn't created yet or creation failed.

Fix:

1. Verify org creation succeeded (check response, verify with GET request)
2. Store organization ID from creation response
3. Use stored ID for membership creation

### Members with status "invited" or "pending"

**Decision:** Import as unverified users OR re-send WorkOS invites?

- **Import as unverified:** Set `emailVerified: false`, user must verify via Magic Auth
- **Re-send invites:** Skip import, use WorkOS invitation flow instead

Choose based on desired UX. Re-sending invites is cleaner but requires user action.

### Name field is null or empty

**Trap:** Do NOT use placeholder values like "Unknown User".

Fix: Set `firstName` to email username part, leave `lastName` empty:

```typescript
const firstName = stytchMember.name || stytchMember.email_address.split("@")[0];
const lastName = stytchMember.name
  ? stytchMember.name.split(" ").slice(1).join(" ")
  : "";
```

## Related Skills

After migration is complete:

- **workos-authkit-nextjs** - If migrating to Next.js
- **workos-authkit-react** - If migrating to React SPA
