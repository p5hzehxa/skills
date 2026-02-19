<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/stytch`

The WorkOS migration guide is the source of truth. If this skill conflicts with it, follow the guide.

## Step 2: Pre-Migration Assessment

### Account Prerequisites

- WorkOS account with API credentials
- Stytch project credentials (`STYTCH_PROJECT_ID`, `STYTCH_SECRET`)
- WorkOS SDK installed in project

### User Type Detection (Decision Tree)

```
What type of Stytch users are you migrating?
  |
  +-- B2B Users (organizations + members)
  |     --> Use Stytch B2B API (search organizations, search members)
  |     --> Export includes organization structure
  |
  +-- Consumer Users (no organizations)
        --> Use Stytch export utility: https://github.com/stytchauth/stytch-node-export-users
        --> Skip organization import steps
```

**This guide covers B2B Users.** For Consumer Users, use Stytch's utility linked above.

## Step 3: Export from Stytch

### Organizations and Members

**API endpoints:**
- Search Organizations: `https://stytch.com/docs/b2b/api/search-organizations`
- Search Members: `https://stytch.com/docs/b2b/api/search-members`

**Pagination:** Both endpoints support pagination for projects with 1000+ records.

**Rate limit:** 100 requests/minute — add delays if exporting large datasets.

**Data to capture per organization:**
- `organization_name` → maps to WorkOS `name`
- `email_allowed_domains` → maps to WorkOS `domainData`

**Data to capture per member:**
- Email address and verification status
- Name (will need parsing into first/last)
- Organization membership
- Member status (`active`, `invited`, `pending`)

### Password Hashes (CRITICAL PATH FORK)

```
Do users sign in with passwords?
  |
  +-- NO  --> Skip password export. Users will use Magic Auth or OAuth.
  |
  +-- YES --> Contact Stytch support (support@stytch.com) to request password hash export.
              Timeline: Variable (can take days/weeks).
              Hash format: Stytch uses scrypt — verify format in export.
              WorkOS supports: scrypt, bcrypt, argon2
```

**Trap warning:** If you proceed without password hashes, users will need to reset passwords or use alternate auth methods. Plan user communication accordingly.

## Step 4: Import into WorkOS

### Import Order (CRITICAL)

1. **Organizations first** — creates org IDs needed for memberships
2. **Users second** — creates user IDs
3. **Memberships third** — links users to orgs

Do NOT attempt to create memberships before both organizations and users exist.

### Organizations

Use WorkOS Create Organization API.

**Mapping:**
- Stytch `organization_name` → WorkOS `name`
- Stytch `email_allowed_domains` → WorkOS `domainData` array

**Domain state values:** Check fetched docs for valid `state` options (typically `verified`, `pending`, etc.)

### Users

Use WorkOS Create User API.

**Name parsing:** Stytch stores single `name` field. Split on first space:
- First word → `firstName`
- Rest → `lastName`

**Member status filter (Decision Tree):**

```
Stytch member status?
  |
  +-- 'active'  --> Import immediately
  |
  +-- 'invited' or 'pending'
        --> Decision: Import as unverified, OR
                     Skip and re-invite after migration
```

**Email verification:** Map Stytch `email_address_verified` to WorkOS `emailVerified`.

### Passwords (If Exported)

**During user creation:** Pass `passwordHash` and `passwordHashType` parameters.

**After user creation:** Use Update User API if you need to add hashes later.

**Supported hash types:** Check fetched docs for complete list. Stytch typically provides `scrypt`.

**Verification:** After import, test login with existing password before notifying users.

### Organization Memberships

Use Create Organization Membership API to link each user to their organization(s).

**Required IDs:**
- `userId` from user creation
- `organizationId` from organization creation

**Stytch multi-org users:** If a member belongs to multiple Stytch organizations, create multiple memberships.

## Step 5: Authentication Method Configuration

### Password Authentication

Enable in WorkOS Dashboard under Authentication tab.

**After import:** Users can sign in with existing passwords immediately (no reset required if hashes imported).

### Magic Auth (Stytch Magic Link Replacement)

**Behavioral difference:**
- Stytch: Clickable link in email
- WorkOS Magic Auth: 6-digit code user enters manually

**Code expiration:** 10 minutes (WorkOS-controlled, not configurable)

**Stytch Email OTP users:** No application changes needed — same UX pattern.

### OAuth Providers

**If users sign in via Google/Microsoft/GitHub:**

1. Configure providers in Dashboard: Authentication > OAuth providers
2. Users link automatically via email matching
3. No code changes needed for user linking

Check fetched docs for provider-specific setup (client IDs, secrets, etc.)

## Step 6: AuthKit Integration

**CRITICAL:** Migration only imports users/orgs — you still need to integrate AuthKit for authentication UI.

Follow these skills based on your stack:
- Next.js App Router → `workos-authkit-nextjs`
- React SPA → `workos-authkit-react`
- Other frameworks → Check fetched docs for framework support

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration integrity:

```bash
# 1. Verify organization count matches
# Compare Stytch export count to WorkOS Dashboard count

# 2. Verify user count matches
# Compare Stytch active members to WorkOS user count

# 3. Verify membership count
# Should equal total member-to-org relationships in Stytch

# 4. Test password login (if hashes imported)
# Attempt login with known Stytch credentials

# 5. Test OAuth login (if configured)
# Attempt login with Google/Microsoft/GitHub

# 6. Check email verification states
# Spot-check users in Dashboard match Stytch verification status
```

**Do not mark migration complete until ALL checks pass.**

## Error Recovery

### "Organization already exists" during import

**Cause:** Duplicate import or organization name collision.

**Fix:**
- Check if you're re-running import without deduplication
- If intentional re-import, query existing orgs first and skip creation
- If name collision, append identifier to `name` field

### "User already exists" during import

**Cause:** Email address already registered in WorkOS.

**Fix:**
- Query existing users by email before creation
- Use Update User API instead of Create if user exists
- Check if this is from previous failed import run

### Password login fails after hash import

**Cause 1:** Wrong `passwordHashType` specified.

**Fix:** Verify Stytch export format matches type you specified (scrypt, bcrypt, etc.)

**Cause 2:** Hash format mismatch.

**Fix:** Contact Stytch support to clarify exact hash format and parameters (salt, iterations, etc.)

**Cause 3:** Hash encoding issue (base64, hex, etc.)

**Fix:** Check fetched docs for expected hash encoding format

### "Invalid organization_id" during membership creation

**Cause:** Attempting to create membership before organization exists, or using Stytch org ID instead of WorkOS org ID.

**Fix:** Store mapping of Stytch org ID → WorkOS org ID during org import, use WorkOS ID for memberships

### Rate limit errors during Stytch export

**Cause:** Exceeding 100 requests/minute.

**Fix:**
- Add 600ms delay between requests
- Use pagination cursors correctly
- Consider batching exports overnight for large datasets

### Users can't find login page after migration

**Cause:** AuthKit not integrated yet — migration only imports data, doesn't add auth UI.

**Fix:** Follow Step 6 to integrate AuthKit. Migration is data-only.

## Post-Migration Tasks

1. **User communication:** Email users about auth method changes (especially Magic Auth vs Magic Link)
2. **Password resets:** For users without imported hashes, trigger password reset flow
3. **OAuth re-authorization:** Users may need to re-authorize OAuth connections
4. **Domain verification:** Verify email domains in WorkOS Dashboard for SSO
5. **Stytch deprecation:** Disable Stytch project only after confirming all users migrated successfully

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
