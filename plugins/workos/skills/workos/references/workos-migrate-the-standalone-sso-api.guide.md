<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This guide covers the migration path. If this skill conflicts with fetched docs, follow docs.

## Step 2: User ID Migration Planning (Decision Tree)

**CRITICAL:** User IDs change when migrating from standalone SSO API to AuthKit.

```
How does your app identify users?
  |
  +-- Standalone SSO Profile IDs (user_xxx) stored in DB
  |     └─> Email is unique in app?
  |           +-- YES --> Map via email field (WorkOS verifies emails)
  |           +-- NO  --> Build migration table: old Profile ID → new User ID
  |                       Run batch script before cutover
  |
  +-- Email as primary key
  |     └─> No migration needed (emails are verified by AuthKit)
  |
  +-- External user system (your own IDs)
        └─> No migration needed (WorkOS IDs are references only)
```

**Before touching code:** Determine your ID strategy. If Profile IDs are foreign keys in your DB, plan the migration script now.

## Step 3: Replace Authorization URL Call

Find where your app calls standalone SSO API's Get Authorization URL:

**Old pattern:**

```
workos.sso.getAuthorizationUrl({
  provider: "GoogleOAuth",
  connection: "conn_xxx",
  redirectUri: "https://app.example.com/callback"
})
```

**New pattern:**

```
workos.userManagement.getAuthorizationUrl({
  provider: "GoogleOAuth",  // or "authkit" for hosted UI
  connection: "conn_xxx",
  redirectUri: "https://app.example.com/callback"
})
```

**Key change:** `sso.getAuthorizationUrl` → `userManagement.getAuthorizationUrl`

All initiation parameters (provider, connection, organization, domainHint, state) work identically.

**AuthKit hosted UI option:** Set `provider: "authkit"` to use WorkOS-hosted login UI. Check fetched docs for hosted UI setup (custom domains, branding).

## Step 4: Replace Callback Handler

Find your callback endpoint (where `code` parameter arrives after OAuth flow).

**Old pattern:**

```
code = request.query.code
profile = workos.sso.getProfileAndToken({ code })
userId = profile.id  // user_xxx format
email = profile.email
```

**New pattern:**

```
code = request.query.code
authResponse = workos.userManagement.authenticateWithCode({
  code: code,
  clientId: WORKOS_CLIENT_ID
})
user = authResponse.user
userId = user.id  // different ID than old profile.id
email = user.email
```

**Key changes:**

- `sso.getProfileAndToken` → `userManagement.authenticateWithCode`
- Response object changed: `profile` → `authResponse.user`
- **User IDs are NEW** — see Step 2 for migration strategy

## Step 5: Handle New Error Responses (TRAP WARNING)

AuthKit returns verification challenges that standalone SSO API did not:

```
Callback returns error instead of user?
  |
  +-- error: "email_verification_required"
  |     └─> User must verify email before login completes
  |          → If using hosted UI: handled automatically
  |          → If using API directly: display verification UI, wait for completion
  |
  +-- error: "mfa_enrollment_required"
  |     └─> Organization requires MFA, user hasn't enrolled
  |          → If using hosted UI: handled automatically
  |          → If using API directly: display MFA enrollment flow
  |
  +-- error: "mfa_challenge_required"
        └─> User must complete MFA challenge
             → If using hosted UI: handled automatically
             → If using API directly: collect MFA code, submit via authenticateWithCode
```

**To disable these flows:** WorkOS Dashboard → Authentication section → toggle off Email Verification / MFA.

**If using hosted UI (`provider: "authkit"`):** These are handled automatically — users never reach your callback until verification is complete.

## Step 6: Update Stored User References

Execute the ID migration plan from Step 2:

**Option A (email-based):**

```bash
# No code changes needed if email is your primary key
# WorkOS guarantees email verification before issuing user object
```

**Option B (Profile ID foreign keys):**

```
For each user in your database:
  1. Look up old Profile ID (user_xxx format)
  2. Fetch user by email from AuthKit API
  3. Store new User ID alongside old Profile ID
  4. Update foreign key references in phases (dual-write period)
```

Check fetched docs for User API endpoints to batch-fetch new IDs.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Confirm authorization call uses userManagement domain
grep "userManagement.getAuthorizationUrl" src/ || echo "FAIL: Still using sso.getAuthorizationUrl"

# 2. Confirm callback uses authenticateWithCode
grep "authenticateWithCode" src/ || echo "FAIL: Still using getProfileAndToken"

# 3. Confirm error handling for new challenges
grep -E "(email_verification|mfa_enrollment)" src/ || echo "WARNING: New error types not handled"

# 4. Test OAuth flow end-to-end
# (manual) - initiate login → complete provider auth → verify callback receives user object
```

## Error Recovery

### "User ID not found" after migration

**Root cause:** Old Profile IDs persisted in DB, new User IDs from AuthKit don't match.

**Fix:**

1. Verify email-based lookup works: `user = findByEmail(authResponse.user.email)`
2. If email not unique, run migration script from Step 6 (Option B)
3. Check: WorkOS Dashboard shows same users in User Management section as old SSO Profiles

### "email_verification_required" blocks all logins

**Root cause:** Email verification enabled in Dashboard, but callback doesn't handle challenge.

**Fix (immediate):**

- Dashboard → Authentication → toggle off "Require email verification"

**Fix (long-term):**

- Switch to hosted UI (`provider: "authkit"`) — handles verification automatically
- Or: implement verification UI in your callback (check fetched docs for verification flow)

### "Invalid client_id" in authenticateWithCode

**Root cause:** `clientId` parameter missing or wrong (this is NEW — standalone SSO API didn't require it in callback).

**Fix:**

1. Verify `WORKOS_CLIENT_ID` env var set (format: `client_xxx`)
2. Pass explicitly to `authenticateWithCode({ code, clientId: WORKOS_CLIENT_ID })`
3. Check: Same client ID used in both authorization URL and callback

### Callback receives code but no user

**Root cause:** User abandoned flow at verification/MFA challenge.

**Fix:**

- Check AuthKit Analytics in Dashboard for drop-off points
- Consider enabling hosted UI to reduce friction
- Or: add "Resume authentication" link using stored state parameter

## Related Skills

- `workos-authkit-nextjs` - Server-side AuthKit integration for Next.js
- `workos-authkit-react` - Client-side AuthKit integration for React
