<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The fetched docs are the source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Migration Assessment

### Export Decision Tree

```
Do users sign in with passwords?
  |
  +-- Yes --> Request password export from Clerk Backend API
  |          (Clerk does NOT export plaintext - only bcrypt hashes)
  |
  +-- No  --> Skip password export, proceed to user data export
```

### Data Sources (choose one)

```
How will you obtain user data?
  |
  +-- Clerk Backend API --> Use /v1/users endpoint, paginate through results
  |
  +-- Clerk Support Export --> Request JSON/CSV file from Clerk support team
```

**CRITICAL:** Clerk does NOT make plaintext passwords available. You will receive bcrypt hashes only.

### Multi-Email Address Trap

Clerk exports multiple emails as pipe-separated strings: `"john@example.com|jane@example.com"`

**Problem:** Export does NOT indicate which email is primary.

**Fix:** If users have multiple emails, fetch User objects from Clerk API to identify primary email BEFORE creating WorkOS users.

## Step 3: User Import Strategy

### Import Method (choose one)

```
Coding preference?
  |
  +-- Use existing tool --> Clone github.com/workos/migrate-clerk-users
  |                         Follow repository README for configuration
  |
  +-- Write custom code --> Use WorkOS User Create API (see Step 4)
```

**Rate limit warning:** User creation is rate-limited. Check fetched docs for current limits before batch importing.

## Step 4: User Data Mapping

### Field Mapping Table

Map Clerk export fields to WorkOS API parameters:

| Clerk Export Field    | WorkOS API Parameter | Notes                                    |
|-----------------------|----------------------|------------------------------------------|
| `email_addresses`     | `email`              | Split pipe-separated values if multiple  |
| `first_name`          | `first_name`         | Direct mapping                           |
| `last_name`           | `last_name`          | Direct mapping                           |
| `password_digest`     | `password_hash`      | Only if passwords exported               |

### Multi-Email Handling Pattern

```typescript
// Pseudocode pattern
const emails = clerkUser.email_addresses.split('|');

if (emails.length > 1) {
  // Fetch Clerk User object from API to find primary
  const primaryEmail = await fetchPrimaryEmailFromClerkAPI(clerkUser.id);
  createWorkOSUser({ email: primaryEmail, ... });
} else {
  createWorkOSUser({ email: emails[0], ... });
}
```

### Password Import Parameters

If importing passwords (bcrypt hashes from Clerk):

- Set `password_hash_type` to `'bcrypt'`
- Set `password_hash` to Clerk's `password_digest` field

**Timing:** Passwords can be imported during user creation OR later via User Update API.

## Step 5: Social Auth Migration

### Provider Configuration

Users who signed in via social auth (Google, Microsoft, etc.) can continue using those providers after migration.

**Pre-migration setup:**

1. Configure provider client credentials in WorkOS Dashboard
2. Check fetched docs → "Integrations" for provider-specific setup

### Auto-Linking Behavior

WorkOS auto-links social auth users by **email address match**. No manual linking required.

**Flow:**

1. User signs in with social provider (e.g., Google)
2. WorkOS receives email from provider
3. WorkOS finds existing user with matching email
4. User is authenticated to existing WorkOS account

**Critical:** Ensure WorkOS user emails match the emails from social providers BEFORE users attempt sign-in.

## Step 6: Organization Migration

### Organization Creation Pattern

```
Export Clerk organizations?
  |
  +-- Yes --> Use Clerk Backend SDK to list organizations
  |          Paginate through results
  |          Create matching WorkOS organizations via API
  |
  +-- No  --> Skip organization migration
```

Check fetched docs for Organization Create API parameters.

### Membership Import Pattern

```
Export organization memberships?
  |
  +-- Yes --> Use Clerk Backend SDK to list memberships per org
  |          Create WorkOS organization memberships via API
  |          Map Clerk user ID → WorkOS user ID
  |
  +-- No  --> Users will not be pre-assigned to organizations
```

**Trap:** You must map Clerk user IDs to WorkOS user IDs. Store this mapping during Step 4 user import.

## Step 7: Multi-Factor Auth Strategy

### MFA Compatibility Matrix

| Clerk MFA Type         | WorkOS Support       | Migration Path                                    |
|------------------------|----------------------|---------------------------------------------------|
| SMS-based second factor| NOT supported        | User must re-enroll with TOTP authenticator       |
| TOTP authenticator     | Supported            | User must re-enroll (secrets not exportable)      |

**CRITICAL:** WorkOS does NOT support SMS-based MFA due to security issues.

### User Communication Plan

Before migration, notify users with SMS-based MFA that they will need to:

1. Use email-based Magic Auth temporarily, OR
2. Re-enroll in MFA using TOTP authenticator app

Check fetched docs → "MFA guide" for enrollment instructions.

## Verification Checklist (ALL MUST PASS)

Run these verifications AFTER completing migration steps:

```bash
# 1. Verify WorkOS API key is valid
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users?limit=1

# 2. Check user count matches expected import
# (Replace with actual expected count)
EXPECTED_COUNT=1000
ACTUAL_COUNT=$(curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.data | length')
[ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ] || echo "FAIL: User count mismatch"

# 3. Verify social auth providers are configured
# (Check WorkOS Dashboard → Integrations)

# 4. Test authentication flow
# Sign in with migrated user credentials and verify success
```

## Error Recovery

### "User with email already exists"

**Cause:** Attempting to create duplicate user during import.

**Fix:**

1. Check if user was already imported in previous run
2. Use User Update API instead of Create API for existing users
3. Implement idempotency by checking user existence before creation

### "Invalid password_hash format"

**Cause:** Password hash from Clerk is malformed or wrong algorithm specified.

**Fix:**

1. Verify `password_hash_type` is set to `'bcrypt'`
2. Confirm hash starts with `$2a$`, `$2b$`, or `$2y$` (bcrypt prefixes)
3. Do NOT modify hash string (no trimming, encoding, etc.)

### "Rate limit exceeded"

**Cause:** User creation API calls exceed rate limit during batch import.

**Fix:**

1. Check fetched docs for current rate limits
2. Implement exponential backoff between API calls
3. Consider using WorkOS migration tool (handles rate limiting)
4. Reduce batch size and increase delay between requests

### Social auth user not auto-linked

**Cause:** Email mismatch between WorkOS user and social provider email.

**Fix:**

1. Verify WorkOS user email exactly matches provider email (case-sensitive)
2. Check provider returns email in auth response (some providers require specific scopes)
3. Confirm provider is properly configured in WorkOS Dashboard

### Organization membership not created

**Cause:** WorkOS user ID not found (user wasn't imported yet or ID mapping failed).

**Fix:**

1. Confirm user was imported in Step 4 before creating memberships
2. Verify Clerk-to-WorkOS user ID mapping is stored and correct
3. Check User Create API response for WorkOS user ID

### MFA enrollment fails after migration

**Cause:** User attempting to use old SMS-based second factor.

**Fix:**

1. Direct user to re-enroll MFA using TOTP authenticator
2. Provide Magic Auth as temporary alternative
3. Check fetched docs → "MFA guide" for enrollment flow
