<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment (Decision Tree)

### User Authentication Methods

Map your Auth0 authentication methods to migration paths:

```
Auth0 auth method?
  |
  +-- Password-based --> LONG PATH: Contact Auth0 support for password export (1+ week)
  |                      → Import users with password hashes (Step 3B)
  |
  +-- Social OAuth only --> SHORT PATH: Create users without passwords (Step 3A)
  |                        → Users auto-link on first social sign-in
  |
  +-- Mixed (password + social) --> SPLIT: Import password users first
                                   → Social users link automatically
```

**Critical decision:** If you need passwords, start the Auth0 support ticket NOW. This is your blocking path — you cannot proceed with password migration until Auth0 processes your export request.

### Organizations

```
Using Auth0 Organizations?
  |
  +-- Yes --> Export via Auth0 Management API
  |          → Create matching WorkOS Organizations (Step 4)
  |          → Import organization memberships (Step 5)
  |
  +-- No --> Skip to Step 6 (MFA considerations)
```

## Step 3: Export Auth0 User Data

### A. Bulk User Export (All Migrations)

Check fetched docs for Auth0 export job instructions. You'll receive a newline-delimited JSON file with:

- `email`
- `email_verified`
- `given_name` / `family_name`

**No passwords in this export** — passwords require separate support ticket.

### B. Password Export (If Using Password Auth)

**BLOCKING:** Contact Auth0 support for password hash export. Check fetched docs for support ticket process.

**Timeline trap:** Auth0 support typically takes 1+ weeks. Plan migration timeline accordingly.

You'll receive a second JSON file with:

- User ID
- `passwordHash` field (bcrypt format)

**Critical:** Auth0 does NOT export plaintext passwords. Only bcrypt hashes are available.

## Step 4: Import Users to WorkOS

### Decision: Tool vs API

```
Comfortable with provided tooling?
  |
  +-- Yes --> Use WorkOS GitHub import tool
  |          → Check fetched docs for repository link
  |
  +-- No --> Write custom import using WorkOS API (see below)
```

### Custom Import Pattern

**Field mapping from Auth0 export to WorkOS API:**

| Auth0 Field      | WorkOS API Parameter |
| ---------------- | -------------------- |
| `email`          | `email`              |
| `email_verified` | `email_verified`     |
| `given_name`     | `first_name`         |
| `family_name`    | `last_name`          |

**For password imports, add:**

- `password_hash_type`: `'bcrypt'`
- `password_hash`: Value from Auth0 `passwordHash` field

Check fetched docs for exact SDK method signature — varies by language.

### Social Auth Users (Auto-Link Pattern)

Users who signed in via Google/Microsoft OAuth do NOT need password imports. They will auto-link on first sign-in IF:

1. Social provider is configured in WorkOS (check fetched docs for provider setup)
2. Email address matches between provider and WorkOS user record

**Email verification trap:** Some users may need to verify email after linking, depending on provider trust level. Gmail users skip verification; generic domains may require it.

## Step 5: Organizations (If Applicable)

### Export from Auth0

Use Auth0 Management API to paginate through organizations. Check fetched docs for API endpoint.

### Create in WorkOS

For each Auth0 organization:

1. Create matching WorkOS Organization using SDK method for organization creation
2. Note the WorkOS organization ID for membership imports

### Import Memberships

Use organization membership data from Auth0 bulk export (Step 3A). For each user-organization pair, call SDK method for adding organization membership.

## Step 6: MFA Migration Considerations

**Breaking change:** Auth0 SMS-based MFA is NOT supported in WorkOS due to security concerns.

### User Impact Decision Tree

```
User has SMS MFA?
  |
  +-- Yes --> User MUST re-enroll in MFA
  |          Options:
  |          → TOTP authenticator (Google Authenticator, 1Password, etc.)
  |          → Email-based Magic Auth
  |
  +-- TOTP MFA --> Migration supported (no re-enrollment needed)
  |
  +-- No MFA --> No action required
```

**Communication requirement:** Notify SMS MFA users BEFORE migration that they'll need to re-enroll.

## Verification Checklist (ALL MUST PASS)

Run these checks post-migration. **Do not mark complete until all pass:**

```bash
# 1. Verify user count matches
# Compare Auth0 export line count with WorkOS user count from dashboard

# 2. Test password authentication
curl -X POST "$WORKOS_API_URL/auth/..." -d '{"email":"test@example.com","password":"..."}'
# Expected: 200 with session token OR 401 if credentials invalid

# 3. Test social OAuth flow
# Manual test: Sign in via Google/Microsoft with known Auth0 user email
# Expected: User auto-links without "user not found" error

# 4. Verify organization memberships (if applicable)
# Check WorkOS dashboard: Sample user shows correct organization membership

# 5. Test MFA (if configured)
# Manual test: User with TOTP MFA can complete challenge
```

**If #2 fails with all users:** Password import likely failed. Check:

- `password_hash_type` parameter was `'bcrypt'`
- `password_hash` field format matches Auth0 export exactly
- No extra whitespace/encoding issues in hash values

**If #3 fails (user not found):** Social provider auto-link not working. Check:

- Provider configured in WorkOS dashboard with correct client credentials
- Email address in WorkOS user record matches provider email exactly
- Provider email domain is supported (check fetched docs for provider trust levels)

## Error Recovery

### "Invalid password hash format"

**Root cause:** Password hash string corrupted during export/import.

Fix:

1. Re-export a single user's password hash from Auth0
2. Compare character-by-character with what was sent to WorkOS API
3. Check for newline characters, trailing spaces, or encoding issues
4. If using the GitHub tool, check tool version supports bcrypt

### "User already exists" during import

**Root cause:** Duplicate emails in Auth0 export, or partial re-import.

Fix:

1. De-duplicate Auth0 export by email before importing
2. If re-importing after partial failure, filter out already-imported users
3. Check WorkOS dashboard for user list — use as exclusion filter

### Social OAuth user sees "Email not verified"

**Root cause:** Provider's email verification status unknown to WorkOS, or email verification enabled in WorkOS environment settings.

Fix:

1. Check WorkOS dashboard → Authentication settings → Email verification
2. If enabled and causing issues, consider provider-specific trust rules
3. Alternatively, send verification email via WorkOS API for affected users

### SMS MFA users locked out post-migration

**Root cause:** SMS MFA removed, users did not re-enroll.

Fix:

1. Communicate re-enrollment process BEFORE migration (too late if already migrated)
2. Provide TOTP setup instructions in first login flow
3. Consider temporary MFA bypass for grace period (check fetched docs for admin controls)

### Organization membership not showing

**Root cause:** Organization created but membership API call failed or skipped.

Fix:

1. Re-run membership import script for affected users
2. Verify organization ID from WorkOS dashboard matches ID used in API calls
3. Check API response — may be rate limited or missing required fields

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
