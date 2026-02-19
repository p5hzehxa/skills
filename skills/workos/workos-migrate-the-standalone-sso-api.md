---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This is the authoritative source. If this skill conflicts with the fetched docs, follow the docs.

## Pre-Migration Assessment

### Identify Migration Scope

Check your codebase for these SSO API patterns:

```bash
# Find SSO initiation calls
grep -r "getAuthorizationUrl\|authorization_url" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb"

# Find callback handlers (GET a Profile and Token)
grep -r "getProfileAndToken\|profile_and_token" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb"

# Find Profile ID persistence
grep -r "profile\.id\|profileId" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb"
```

**Document these locations** — you'll update each one.

### Data Impact (CRITICAL)

**User IDs will change.** The standalone SSO API returned Profile IDs (`profile_*`). AuthKit returns User IDs (`user_*`).

```
Migration strategy?
  |
  +-- Email is unique identifier --> Use email to link old/new records
  |
  +-- Profile ID is foreign key --> Build migration mapping table
  |
  +-- Mixed approach --> Consult fetched docs for multi-key scenarios
```

**Before starting code changes:** Determine how you'll reconcile existing Profile IDs with new User IDs.

## Step 2: Update SSO Initiation Calls

### Locate Authorization URL Generation

Find calls to the standalone SSO "Get Authorization URL" endpoint. Pattern varies by SDK:

- Node.js: `workos.sso.getAuthorizationUrl()`
- Python: `workos.sso.get_authorization_url()`
- Ruby: `workos.sso.authorization_url()`

### Switch to AuthKit Authorization URL

Replace with AuthKit equivalent. Check fetched docs for exact method signature in your SDK language.

**Key differences:**
- Endpoint path changes (SSO → AuthKit)
- All SSO parameters still supported (`connection`, `organization`, `provider`, etc.)
- New `authkit` provider type available (enables hosted UI flows)

**Pseudocode pattern:**

```
// OLD (standalone SSO)
url = sso.getAuthorizationUrl({
  connection: conn_id,
  redirect_uri: callback_url,
  state: csrf_token
})

// NEW (AuthKit)
url = authkit.getAuthorizationUrl({
  connection: conn_id,  // same parameter
  redirect_uri: callback_url,  // same parameter
  state: csrf_token  // same parameter
})
```

**Verify:** Authorization redirects still work after code change.

## Step 3: Update Callback Handler

### Locate Token Exchange

Find where your callback receives `code` and calls "Get a Profile and Token". Pattern varies by SDK:

- Node.js: `workos.sso.getProfileAndToken()`
- Python: `workos.sso.get_profile_and_token()`
- Ruby: `workos.sso.profile_and_token()`

### Switch to AuthKit Authenticate

Replace with AuthKit `authenticate()` call using `grant_type: "authorization_code"`.

Check fetched docs for exact method signature and response schema.

**Pseudocode pattern:**

```
// OLD (standalone SSO)
result = sso.getProfileAndToken(code)
profile = result.profile  // Profile object
profile_id = profile.id   // profile_01...

// NEW (AuthKit)
result = authkit.authenticate({
  code: code,
  grant_type: "authorization_code"
})
user = result.user        // User object (richer than Profile)
user_id = user.id         // user_01... (DIFFERENT ID)
```

### Update Response Handling (CRITICAL)

The response structure changes significantly:

**Profile object (old):**
- `id` (Profile ID)
- `email`
- `first_name`, `last_name`
- Connection metadata

**User object (new):**
- `id` (User ID - DIFFERENT from Profile ID)
- `email` (verified)
- `first_name`, `last_name`
- `email_verified` (boolean)
- Authentication method metadata
- Organization memberships (richer structure)

**Update all code that accesses response fields.** The `id` field is NOT compatible.

## Step 4: Reconcile User Identity

### Email-Based Reconciliation (Recommended)

If email is unique in your system:

```
On successful authentication:
  |
  +-- Query local DB for user by email
  |
  +-- User exists? --> Update record with new user_id
  |
  +-- User doesn't exist? --> Create new user record
```

AuthKit guarantees email is verified before returning success.

### Profile ID Migration Table (Alternative)

If you must preserve Profile IDs:

1. Create mapping table: `profile_id -> user_id`
2. First auth after migration: Record both IDs
3. Subsequent queries: Look up by user_id first, fall back to profile_id

**Check fetched docs** for guidance on bulk migration strategies if applicable.

## Step 5: Handle New Authentication Flows

AuthKit introduces flows that didn't exist in standalone SSO:

### Email Verification Challenge

**Scenario:** User authenticates with unverified email.

**Response:** `email_verification_required` error with challenge code.

**Decision tree:**

```
Email verification error?
  |
  +-- Using AuthKit Hosted UI? --> Already handled, shouldn't occur
  |
  +-- Custom UI? --> Display verification prompt, re-authenticate after
```

Check fetched docs for error response schema and re-authentication flow.

### MFA Enrollment Challenge

**Scenario:** Organization policy requires MFA, user hasn't enrolled.

**Response:** MFA enrollment challenge.

Check fetched docs for MFA challenge handling patterns.

### Account Linking

**Scenario:** User authenticates with email already associated with different auth method.

**Response:** Account linking challenge.

Check fetched docs for linking flow patterns.

### Disabling Advanced Flows (Escape Hatch)

If these flows block your migration, disable in WorkOS Dashboard:

1. Navigate to **Authentication** section
2. Toggle off: Email Verification, MFA Requirements, Account Linking

**Warning:** Disabling security features is not recommended for production.

## Step 6: Consider AuthKit Hosted UI

### Hosted UI vs. Custom UI (Decision Tree)

```
Authentication UI approach?
  |
  +-- Need full control over UI? --> Use AuthKit API directly (Steps 2-5)
  |
  +-- Prefer managed solution? --> Switch to AuthKit Hosted UI
                                    |
                                    +-- Pass provider="authkit" in initiation
                                    +-- Hosted UI handles all error flows
```

**AuthKit Hosted UI benefits:**
- Email verification, MFA, account linking handled automatically
- No callback error handling needed
- Brandable in WorkOS Dashboard

Check fetched docs for Hosted UI configuration and custom domain setup.

**Initiation change for Hosted UI:**

```
// Instead of connection/organization-specific provider
url = authkit.getAuthorizationUrl({
  provider: "authkit",  // Routes to hosted UI
  redirect_uri: callback_url,
  state: csrf_token
})
```

## Verification Checklist (ALL MUST PASS)

Run these commands AFTER code changes, BEFORE deploying:

```bash
# 1. Confirm no standalone SSO API calls remain
! grep -r "sso\.getAuthorizationUrl\|sso\.authorization_url" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" || echo "FAIL: Found SSO API calls"

# 2. Confirm no Profile ID persistence in new code
! grep -r "profile\.id" --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" || echo "WARNING: Check if Profile ID usage is legacy"

# 3. Test auth flow end-to-end
# (Manual: Click SSO button, complete auth, verify callback receives User object)

# 4. Verify User ID format
# (Manual: Check that persisted IDs start with "user_" not "profile_")

# 5. Application builds successfully
npm run build  # or equivalent for your stack
```

**If check #1 fails:** You missed an SSO API call. Grep output shows location.

**If check #4 fails:** Callback is still using old API or SDK version is wrong.

## Error Recovery

### "Invalid grant" error in callback

**Most common causes:**
1. Using old SSO API method instead of AuthKit authenticate
2. Code expired (user took too long to complete auth)
3. Code already used (callback called twice)

**Fix:** Verify callback uses `authkit.authenticate()` with `grant_type: "authorization_code"`.

### "User not found" after migration

**Root cause:** Lookup using old Profile ID, but DB now has User ID.

**Fix:** Implement email-based reconciliation (Step 4). Query by email first.

### "Email verification required" blocking auth

**Root cause:** Email verification enabled in Dashboard, but custom UI doesn't handle challenge.

**Fix options:**
1. Disable email verification in Dashboard (temporary)
2. Implement verification challenge flow (check fetched docs)
3. Switch to AuthKit Hosted UI (handles automatically)

### "Cannot read property 'profile' of undefined"

**Root cause:** Response is User object now, not Profile object.

**Fix:** Change `result.profile` to `result.user`. Update all field accesses.

### Authorization URL unchanged after code update

**Root cause:** Cached SDK instance or wrong import path.

**Fix:** 
- Verify SDK import uses AuthKit module, not SSO module
- Restart dev server to clear module cache
- Check SDK version supports AuthKit (may need upgrade)

### Type errors on User object fields

**Root cause:** TypeScript/static types still reference Profile type.

**Fix:** Import User type from SDK, update type annotations.

## Post-Migration

### Monitor for Dual IDs

During transition period, you may have users with both Profile IDs and User IDs in your database.

**Recommended query pattern:**

```
function getUserByWorkOSId(id) {
  if (id.startsWith('user_')) {
    return queryByUserId(id)
  } else if (id.startsWith('profile_')) {
    return queryByProfileId(id)  // Legacy fallback
  }
}
```

### Cleanup Old SSO Configuration

Once migration is stable:
1. Remove unused SSO API imports
2. Remove Profile ID columns (after data migration complete)
3. Archive old callback routes if you changed paths

## Related Skills

- workos-authkit-nextjs — If migrating Next.js app, use this for modern integration patterns
- workos-authkit-react — If migrating React SPA, use this for client-side flows
