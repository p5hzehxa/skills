---
name: workos-migrate-clerk
description: Migrate to WorkOS from Clerk.
---

<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

Before writing code, determine your data scope:

```
What are you migrating?
  |
  +-- Users only?
  |     |
  |     +-- Password-based? --> Proceed to Step 3 (Password Export)
  |     |
  |     +-- Social auth only? --> Skip to Step 5 (Social Auth)
  |     |
  |     +-- Both? --> Do Step 3, then Step 5
  |
  +-- Users + Organizations?
        |
        +-- Follow User path above, then add Step 6 (Organizations)
```

**MFA strategy decision (CRITICAL):**

- If users have SMS-based MFA in Clerk, you MUST plan re-enrollment (WorkOS does not support SMS MFA due to security issues)
- Users will need to switch to TOTP authenticator apps or email-based Magic Auth
- Document this requirement for user communication

## Step 3: Password Export (If Applicable)

**CRITICAL:** Clerk does NOT expose plaintext passwords. You must use their backend API to export password hashes as CSV.

### Export Command Pattern

Use Clerk Backend SDK to retrieve users with password digests:

```pseudocode
For each user with password_digest:
  Export to CSV with columns: user_id, email, password_digest, first_name, last_name
```

Clerk uses `bcrypt` hashing — WorkOS supports this algorithm natively.

Check fetched docs for Clerk Backend API endpoint to export users with passwords.

**Verification:** CSV file contains `password_digest` column with bcrypt hashes (start with `$2a$` or `$2b$`).

## Step 4: User Import (Two Paths)

### Path A: Use WorkOS Import Tool (Recommended for Large Migrations)

WebFetch: `https://github.com/workos/migrate-clerk-users`

Clone repo, follow README for bulk import automation.

**Verify:** Tool successfully imports test batch of 10 users before running full migration.

### Path B: Direct API Integration

Use WorkOS Create User API with this field mapping:

```
Clerk export field    --> WorkOS API parameter
email_addresses       --> email
first_name            --> first_name
last_name             --> last_name
password_digest       --> password_hash (with password_hash_type: 'bcrypt')
```

**Rate limit trap:** User creation is rate-limited. Check fetched docs for current limits before bulk import.

### Multi-Email Users (Decision Point)

If Clerk export contains pipe-separated emails:

```json
"email_addresses": "john@example.com|john.doe@example.com"
```

**You MUST determine primary email** — Clerk export does not indicate which is primary.

Options:
1. Fetch User object from Clerk API to get primary email flag, OR
2. Use leftmost email as primary (common convention), OR
3. Manually review and specify

**Do NOT guess** — incorrect primary email breaks login flow.

### Password Import Parameters

If importing passwords alongside users:

```pseudocode
CreateUserRequest:
  email: from_clerk_export
  first_name: from_clerk_export
  last_name: from_clerk_export
  password_hash: clerk_password_digest  # The bcrypt hash
  password_hash_type: 'bcrypt'          # MUST specify algorithm
```

**Critical:** `password_hash_type` is REQUIRED when providing `password_hash`. Omitting it causes silent auth failures.

## Step 5: Social Auth Provider Migration

If users authenticated via Google, Microsoft, or other OAuth providers in Clerk:

### Provider Configuration (BLOCKING)

For each social provider used in Clerk:

1. Navigate to WorkOS Dashboard → Authentication → Social Providers
2. Configure provider with OAuth client credentials
3. Verify redirect URIs match your application's callback routes

Check fetched docs for provider-specific configuration steps.

**Email matching:** WorkOS links social auth to existing users by email address. Ensure:
- Social provider email matches imported user email
- Users verify email ownership during first WorkOS login

**Verification:**
```bash
# Test social login flow for each provider
# User should link to existing account, not create duplicate
```

## Step 6: Organization Migration (If Applicable)

If migrating Clerk organizations:

### Export Organizations from Clerk

Use Clerk Backend SDK to paginate through organizations:

```pseudocode
For each Clerk organization:
  Export: organization_id, name, metadata
```

Check fetched docs for Clerk organization list API pagination parameters.

### Create WorkOS Organizations

Map Clerk organizations to WorkOS:

```pseudocode
For each exported org:
  POST /organizations
    name: clerk_org_name
    # Check fetched docs for additional supported fields
```

### Migrate Organization Memberships

**CRITICAL:** Memberships must be migrated AFTER both users and organizations exist.

1. Export Clerk memberships using Backend SDK (user_id, organization_id pairs)
2. Create WorkOS memberships using Organization Membership API

```pseudocode
For each Clerk membership:
  POST /organization_memberships
    user_id: workos_user_id          # Map from Clerk user_id
    organization_id: workos_org_id   # Map from Clerk org_id
    # Check fetched docs for role mapping if using role slugs
```

**Maintain ID mapping:** Keep a lookup table of Clerk IDs → WorkOS IDs for membership creation.

## Step 7: MFA Re-Enrollment Communication

**USER IMPACT:** Users with SMS-based MFA in Clerk will lose MFA on migration.

Required actions:

1. Identify users with SMS MFA in Clerk export
2. Send communication BEFORE migration explaining:
   - SMS MFA will not carry over
   - Users must re-enroll using TOTP authenticator app or email-based Magic Auth
3. Provide instructions for MFA enrollment post-migration

Check fetched docs for WorkOS MFA enrollment flows — direct users to AuthKit UI or provide programmatic enrollment.

**Do NOT attempt to migrate SMS MFA settings** — WorkOS does not support this method.

## Verification Checklist (ALL MUST PASS)

Run these checks post-migration:

```bash
# 1. Verify user count matches
# Compare Clerk export row count to WorkOS user list
curl -u "$WORKOS_API_KEY:" https://api.workos.com/users | jq '.data | length'

# 2. Test password login for migrated user
# Should succeed with original Clerk password

# 3. Test social auth for provider user
# Should link to existing account, not create new user

# 4. Verify organization memberships (if applicable)
# Check sample user shows correct org membership in WorkOS Dashboard

# 5. MFA re-enrollment works for TOTP
# Test user can enroll new authenticator app
```

**If check #2 fails:** Verify `password_hash_type: 'bcrypt'` was set during import. Missing this parameter causes silent auth failures.

**If check #3 creates duplicate user:** Social provider email does not match imported user email. Check email normalization (lowercase, trimming).

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in import data or previous partial import.

Fix:
1. Check for duplicate emails in Clerk export (pipe-separated emails may cause this)
2. If partial import, query WorkOS for existing users and skip them
3. Use upsert pattern if available in import tool

### Password login fails after import

**Cause:** `password_hash_type` not set or incorrect.

Fix:
1. Verify import included `password_hash_type: 'bcrypt'`
2. Use Update User API to re-import password with correct type
3. Check bcrypt hash format (must start with `$2a$` or `$2b$`)

### Social auth creates new user instead of linking

**Cause:** Email mismatch between social provider and imported user.

Fix:
1. Verify social provider returns email claim
2. Check email case sensitivity (normalize to lowercase)
3. Ensure social provider email is verified (unverified emails may not match)

### Rate limit errors during bulk import

**Cause:** Exceeded WorkOS user creation rate limit.

Fix:
1. Check fetched docs for current rate limits
2. Add exponential backoff between requests
3. Use WorkOS import tool (handles rate limiting automatically)

### Organization membership creation fails

**Cause:** User or organization does not exist in WorkOS yet.

Fix:
1. Verify import order: Users → Organizations → Memberships
2. Check ID mapping table for correct WorkOS IDs
3. Query WorkOS API to confirm user/org exists before membership creation

### "Invalid password hash" error

**Cause:** Password hash format not recognized or algorithm mismatch.

Fix:
1. Verify hash is bcrypt format (starts with `$2a$` or `$2b$`)
2. Check for extra whitespace in hash string
3. Ensure full hash exported from Clerk (not truncated)

## Related Skills

- workos-authkit-nextjs (for post-migration AuthKit integration)
- workos-authkit-react (for post-migration AuthKit integration)
