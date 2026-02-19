<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

The migration docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Auth0 Data Inventory

Before exporting anything, determine what you need to migrate:

```
User authentication method?
  |
  +-- Password-based --> Need password hashes (requires Auth0 support ticket)
  |
  +-- Social auth only --> Skip password export, configure OAuth providers in WorkOS
  |
  +-- Both --> Need both password export AND provider setup
```

```
Using Auth0 Organizations?
  |
  +-- Yes --> Plan organization + membership migration
  |
  +-- No  --> User migration only
```

```
MFA enrolled users?
  |
  +-- SMS-based --> INCOMPATIBLE. Users must re-enroll with TOTP or use Magic Auth
  |
  +-- TOTP-based --> Cannot migrate enrollments. Users must re-enroll in WorkOS
```

**Critical incompatibility:** WorkOS does not support SMS-based MFA. Users with SMS second factors will lose MFA enrollment and must re-enroll.

## Step 3: Export Auth0 User Data

### Basic User Export

Use Auth0's "Bulk User Export" extension. Check fetched docs for exact steps.

Export includes: email, email_verified, given_name, family_name, user_id.

### Password Hash Export (BLOCKING if needed)

**If users sign in with passwords:**

1. Open ticket with Auth0 support requesting password hash export
2. **WAIT** — this takes 1-2 weeks minimum
3. Receive separate NDJSON file with `passwordHash` field

Auth0 does NOT provide plaintext passwords. Only bcrypt hashes are exportable.

**Verification:** Confirm `passwordHash` field exists in export before writing import code.

## Step 4: Import Users into WorkOS

### Decision: Tool vs. API

```
Migration scale?
  |
  +-- < 10k users, simple mapping --> Use WorkOS migration tool (GitHub repo)
  |
  +-- > 10k users OR custom logic --> Write import script using WorkOS API
```

Migration tool: `https://github.com/workos/migrate-auth0-users`

### Field Mapping (API approach)

Auth0 export → WorkOS Create User API:

| Auth0 field      | WorkOS parameter |
|------------------|------------------|
| `email`          | `email`          |
| `email_verified` | `email_verified` |
| `given_name`     | `first_name`     |
| `family_name`    | `last_name`      |

### Password Import Pattern

**If you have password hashes:**

```
During user creation OR as separate update?
  |
  +-- During creation --> Include password fields in Create User call
  |
  +-- After creation  --> Use Update User API for existing users
```

Required parameters for passwords:
- `password_hash_type`: `"bcrypt"` (Auth0 uses bcrypt)
- `password_hash`: value from Auth0's `passwordHash` field

Check fetched docs for exact API signature — it varies by SDK language.

## Step 5: Configure Social Auth Providers (if needed)

**Only if Auth0 users signed in via Google, Microsoft, GitHub, etc.**

### Provider Setup

For each social provider Auth0 used:

1. Check `/integrations` page in fetched docs for provider-specific guide
2. Create OAuth app with provider (Google Console, Azure, etc.)
3. Add client credentials to WorkOS Dashboard

### Automatic Linking

WorkOS links social auth users by **email address match**. No manual linking needed.

**Trap:** Email verification behavior depends on provider trust level:
- Trusted domains (e.g., `@gmail.com` via Google OAuth) → no verification needed
- Untrusted/custom domains → user must verify email in WorkOS

If you enabled email verification in WorkOS auth settings, warn users they may need to verify on first sign-in.

## Step 6: Migrate Organizations (if applicable)

**Skip this step if not using Auth0 Organizations.**

### Export Auth0 Organizations

Use Auth0 Management API to paginate organizations. Check Auth0 docs for endpoint — typically `GET /api/v2/organizations`.

### Create WorkOS Organizations

For each Auth0 org, call WorkOS Create Organization API. Check fetched docs for required fields.

### Add Organization Memberships

Auth0's "Bulk User Export" includes organization membership data. For each user-org pair, call WorkOS Organization Membership API.

**Verification:** Confirm membership count matches Auth0 before marking complete.

## Step 7: MFA Migration (CRITICAL LIMITATION)

**WorkOS does NOT support:**
- SMS-based MFA (security reasons)
- Importing existing TOTP enrollments

### MFA Transition Plan

```
Auth0 MFA method?
  |
  +-- SMS --> Users LOSE MFA. Offer Magic Auth or force TOTP re-enrollment
  |
  +-- TOTP --> Users must RE-ENROLL in WorkOS. Cannot import secrets
```

**Required user communication:** Warn MFA users they must re-enroll on first WorkOS sign-in.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration readiness:

```bash
# 1. Check password hash file exists (if migrating passwords)
test -f auth0-passwords.ndjson && echo "PASS" || echo "SKIP: no passwords"

# 2. Check WorkOS API key is set
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS" || echo "FAIL: invalid API key"

# 3. Verify user count matches Auth0 export
# (Replace 12345 with expected count from Auth0 dashboard)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" \
  | jq '.list_metadata.after' # Should be non-null if users exist

# 4. Check social auth provider configured (if needed)
# Dashboard check: WorkOS Dashboard → Configuration → Authentication → Connections
```

**If check #3 returns zero users:** Import script failed silently. Check API error responses.

## Error Recovery

### "Cannot import password hash"

**Root cause:** `password_hash_type` doesn't match Auth0's algorithm.

Fix:
1. Confirm Auth0 uses bcrypt (check their docs if unsure)
2. Set `password_hash_type: "bcrypt"` exactly
3. Verify `password_hash` starts with `$2` (bcrypt format)

### "User already exists" during import

**Root cause:** Duplicate email in Auth0 export, or partial retry.

Decision tree:
```
Intentional duplicate import?
  |
  +-- Yes (re-running script) --> Use upsert pattern or skip existing users
  |
  +-- No (data error) --> Deduplicate Auth0 export before import
```

### Social auth users can't sign in

**Root cause 1:** Provider not configured in WorkOS Dashboard.

Fix: Complete Step 5. Check Dashboard → Configuration → Authentication → Connections.

**Root cause 2:** Email mismatch between Auth0 and provider.

Fix: User must sign in with same email used in Auth0. WorkOS links by email.

### MFA users locked out

**Expected behavior** — see Step 7. SMS and TOTP enrollments cannot migrate.

Fix: User must re-enroll MFA in WorkOS, or use Magic Auth (email-based).

### Auth0 password export takes > 2 weeks

**Expected** — Auth0 support tickets have no SLA.

Workaround: Proceed with social auth migration first. Add password import later.

### Organization membership count mismatch

**Root cause:** Auth0 export pagination incomplete.

Fix:
1. Verify Auth0 API calls paginated correctly (check `next` tokens)
2. Compare WorkOS org membership count to Auth0 dashboard count
3. Re-import missing pages

## Post-Migration Validation

**Before switching traffic to WorkOS:**

1. Test sign-in with password-based user (if migrating passwords)
2. Test sign-in with social auth user (for each provider)
3. Test organization membership access (if using orgs)
4. Confirm MFA re-enrollment flow works
5. Load test: simulate production sign-in volume

**Rollback plan:** Keep Auth0 active until WorkOS sign-in success rate matches Auth0's baseline.

## Related Skills

- workos-authkit-nextjs — Integrate WorkOS into Next.js after migration
- workos-authkit-react — Integrate WorkOS into React apps after migration
