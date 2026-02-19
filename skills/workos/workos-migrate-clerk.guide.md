<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Migration Decision Tree

```
Do you need to preserve user passwords?
  |
  +-- YES --> Clerk Backend API export required (Step 3A)
  |           Then proceed to Step 4 (import with hashes)
  |
  +-- NO  --> Skip password export
              Proceed directly to Step 3B (user data only)
```

**Critical limitation:** Clerk does NOT export plaintext passwords. Only bcrypt hashes via their Backend API.

## Step 3A: Export Passwords (If Needed)

Use Clerk Backend API to export users with password hashes as CSV:

- Check fetched docs for Clerk API endpoint
- Exported field name: `password_digest`
- Algorithm: bcrypt (WorkOS-compatible)

**Verification:** CSV contains `password_digest` column with bcrypt hashes (starts with `$2a$` or `$2b$`).

## Step 3B: Export User Data

Two paths:

**Path A: Clerk Backend API**
- Paginate through users programmatically
- Standard fields: `email_addresses`, `first_name`, `last_name`

**Path B: Clerk Support**
- Request JSON export from Clerk support team
- Same field schema

**Multi-email trap:** Clerk separates multiple emails with pipe (`|`). Export does NOT indicate which is primary. Use Clerk User object API to determine primary before importing.

## Step 4: Import Users to WorkOS

### Field Mapping

```
Clerk export       --> WorkOS Create User API
email_addresses    --> email
first_name         --> first_name
last_name          --> last_name
password_digest    --> password_hash (if exported)
```

### Import Method Decision

```
User count?
  |
  +-- <1000  --> Use WorkOS GitHub migration tool
  |              (github.com/workos/migrate-clerk-users)
  |
  +-- 1000+  --> Write custom script using WorkOS API
                 (rate limits apply - check fetched docs)
```

### Password Hash Parameters (CRITICAL)

If importing passwords, pass to WorkOS Create User API:

- `password_hash_type`: `'bcrypt'`
- `password_hash`: value from Clerk's `password_digest` field

**Trap:** Do NOT pass plaintext passwords. WorkOS expects the bcrypt hash exactly as exported.

## Step 5: Handle Multi-Email Users

For users with pipe-separated emails in Clerk export:

1. Use Clerk User object API to fetch primary email indicator
2. Import primary email to WorkOS `email` field
3. Store additional emails in WorkOS user metadata if needed

**Do NOT guess** which email is primary from export alone.

## Step 6: Social Auth Migration

Users who signed in via social providers (Google, Microsoft, etc.) in Clerk:

1. Configure equivalent provider in WorkOS Dashboard (see integrations page in fetched docs)
2. No explicit migration needed — WorkOS auto-links by email on first sign-in
3. User signs in with provider → WorkOS matches by email → links to imported user

**Critical:** Email matching is case-sensitive. Normalize emails during import.

## Step 7: Organization Export (If Using)

If you use Clerk organizations:

### Export Organizations

Use Clerk Backend SDK to paginate organization list. For each org:

1. Export org data
2. Create matching WorkOS organization via API

Check fetched docs for WorkOS Organization Create API parameters.

### Export Memberships

Use Clerk Backend SDK to paginate memberships per organization. For each membership:

1. Map Clerk user ID → WorkOS user ID (from Step 4 import)
2. Create WorkOS organization membership via API

Check fetched docs for WorkOS Organization Membership Create API parameters.

**Trap:** Complete user import (Step 4) BEFORE creating memberships. Membership creation will fail for non-existent users.

## Step 8: MFA Migration (Manual Re-enrollment)

**CRITICAL INCOMPATIBILITY:** Clerk SMS-based MFA cannot migrate to WorkOS.

WorkOS does NOT support SMS MFA due to security issues. Affected users MUST:

1. Re-enroll using TOTP authenticator app, OR
2. Switch to WorkOS email-based Magic Auth

**Communication plan required:** Notify SMS MFA users before migration. Provide re-enrollment instructions.

Check fetched docs for WorkOS MFA enrollment guide.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Verify WorkOS environment variables set
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: Missing WorkOS env vars"

# 2. Test user import with sample user (replace with actual user data)
curl -X POST https://api.workos.com/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","first_name":"Test"}' \
  | jq -r '.id' || echo "FAIL: User creation failed"

# 3. Verify social provider configured (replace PROVIDER with actual, e.g., google_oauth)
# Check WorkOS Dashboard → Authentication → Social Providers
echo "Manually verify social providers in Dashboard"

# 4. Test organization creation if using (replace with actual org data)
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org"}' \
  | jq -r '.id' || echo "FAIL: Org creation failed"
```

## Error Recovery

### "User creation rate limit exceeded"

**Root cause:** Importing users too quickly.

Fix:
1. Check fetched docs for current rate limits
2. Add delay between Create User API calls
3. Implement exponential backoff on 429 responses
4. Consider using WorkOS migration tool (handles rate limiting)

### "Invalid password hash format"

**Root cause:** Passing plaintext password or wrong hash type.

Fix:
1. Verify Clerk export contains `password_digest` field
2. Verify hash starts with `$2a$` or `$2b$` (bcrypt prefix)
3. Pass `password_hash_type: 'bcrypt'` parameter
4. Do NOT modify hash value from Clerk export

### "Email already exists"

**Root cause:** Duplicate user import or email collision.

Fix:
1. Check if user already exists before creating
2. Use Update User API instead if updating existing user
3. For multi-email users, ensure only primary email used for `email` field

### "Organization membership failed: user not found"

**Root cause:** Creating membership before user imported.

Fix:
1. Complete ALL user imports (Step 4) first
2. Maintain mapping: Clerk user ID → WorkOS user ID
3. Use WorkOS user ID when creating memberships

### "Social auth user not linked after sign-in"

**Root cause:** Email mismatch between imported user and social provider email.

Fix:
1. Verify imported email exactly matches social provider email
2. Check for email case sensitivity differences
3. Ensure social provider configured in WorkOS Dashboard before testing
4. Check WorkOS logs for linking errors

### Clerk export missing `password_digest`

**Root cause:** Using standard export instead of Backend API export.

Fix:
1. Use Clerk Backend API export (not Dashboard export)
2. Check fetched docs for Clerk changelog link (2024-10-23 feature)
3. Ensure API export includes password data parameter

### MFA users cannot sign in after migration

**Root cause:** SMS MFA users not re-enrolled.

Fix:
1. Identify SMS MFA users in Clerk before migration
2. Send re-enrollment instructions BEFORE migration
3. Provide fallback: temporary password reset for SMS users
4. Guide users to enroll TOTP or switch to Magic Auth

## Related Skills

After migration complete:
- workos-authkit-nextjs — if using Next.js
- workos-authkit-react — if using React
- workos-authkit-vanilla-js — if using vanilla JavaScript
