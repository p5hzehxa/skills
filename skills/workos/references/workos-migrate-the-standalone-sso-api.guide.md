<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Migration Inventory

### Identify Existing Integration Points

Locate these patterns in your codebase:

```bash
# Find authorization URL calls
grep -r "getAuthorizationUrl\|get_authorization_url\|GetAuthorizationURL" .

# Find profile exchange calls
grep -r "getProfileAndToken\|get_profile_and_token\|GetProfileAndToken" .

# Find profile ID references
grep -r "profile_id\|profileId\|ProfileID" .
```

**Critical:** Note every location. These are your migration touchpoints.

### User Identifier Strategy (DECISION TREE)

```
Primary user identifier in your app?
  |
  +-- Email (unique) --> Migration path: map User.email to application user
  |                      WorkOS verifies email before auth completes
  |
  +-- Profile/User ID  --> Migration BLOCKER: User IDs will change
                          Action: Add email as secondary index BEFORE migrating
                                  OR implement ID mapping table
```

**If using Profile IDs as primary keys:** DO NOT proceed until you resolve ID strategy. WorkOS User IDs ≠ Profile IDs.

## Step 3: Replace Authorization Initiation

### Find: Standalone SSO API Pattern

```
workos.sso.getAuthorizationUrl({
  organization: org_id,
  redirectUri: callback_url,
  state: csrf_token
})
```

### Replace With: AuthKit Pattern

```
workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',  // New: enables password + SSO
  redirectUri: callback_url,
  state: csrf_token
})
```

**Key differences:**

- Domain: `sso.*` → `userManagement.*`
- Parameter: `organization` → `provider` (or keep `organization` for SSO-only)
- New capability: `provider: 'authkit'` enables password auth + all configured SSO connections

**Organization parameter behavior:**

- If `organization` is provided → user sees only that org's SSO connection
- If omitted and `provider: 'authkit'` → user sees org selector + password option
- Check fetched docs for connection selection UI flows

## Step 4: Replace Profile Exchange

### Find: Standalone SSO API Pattern

```
callback endpoint receives: code, state

workos.sso.getProfileAndToken({
  code: code
})

returns: { profile, access_token }
profile.id = "prof_..."
```

### Replace With: AuthKit Pattern

```
callback endpoint receives: code, state (unchanged)

workos.userManagement.authenticateWithCode({
  code: code
})

returns: { user, organizationId, accessToken, refreshToken }
user.id = "user_..."  // DIFFERENT ID FORMAT
```

**CRITICAL ID MIGRATION:**

```
Old: profile.id = "prof_01H..."
New: user.id = "user_01H..."

Profile IDs and User IDs are DIFFERENT for the same person.
```

### User Object Mapping

Check fetched docs for complete User schema. Key fields:

- `user.email` → Same as `profile.email` (verified by WorkOS)
- `user.firstName` / `user.lastName` → Same as `profile.first_name` / `profile.last_name`
- `user.emailVerified` → New: boolean indicating verification status
- `user.id` → DIFFERENT from `profile.id`

## Step 5: Handle New Authentication Responses

AuthKit returns structured error responses for security flows. Standalone SSO API had no equivalent.

### Email Verification Required

**Response structure:**

```
{
  code: "email_verification_required",
  email: user_email,
  pendingAuthenticationToken: token
}
```

**Decision tree:**

```
Email verification response received?
  |
  +-- Using AuthKit Hosted UI --> No action needed (UI handles it)
  |
  +-- Using custom UI --> Display "Check your email" message
                          Wait for user to click verification link
                          WorkOS redirects back to your callback with new code
```

**Do NOT** build custom email verification — WorkOS sends the email. Just show a waiting state.

### Account Linking

**Scenario:** User email exists in WorkOS but authenticated via different method.

**Response structure:**

```
{
  code: "user_pending",
  email: user_email,
  pendingAuthenticationToken: token
}
```

**Agent action:** If not using AuthKit Hosted UI, show "Account already exists. Log in with [original method]" message.

### MFA Enrollment

Only occurs if MFA is required in WorkOS Dashboard _Authentication_ settings.

**Disable path:** WorkOS Dashboard → Authentication → MFA → Set to "Optional" or "Off"

**If keeping MFA:** Check fetched docs for MFA enrollment response structure. AuthKit Hosted UI handles it automatically.

### Response Handling (Implementation Pattern)

```
response = workos.userManagement.authenticateWithCode(code)

if response.user exists:
  // Success path
  user_id = response.user.id
  email = response.user.email

  // Map to application user by email
  app_user = find_user_by_email(email)

  // Create session with new WorkOS user_id
  create_session(app_user.id, workos_user_id=user_id)

else if response.code == "email_verification_required":
  // Show "Check your email" UI
  // No retry needed - WorkOS handles redirect after verification

else if response.code == "user_pending":
  // Show "Account exists. Log in with [method]" message
```

## Step 6: AuthKit Hosted UI (Optional Upgrade)

**Value:** Pre-built UI for email verification, MFA, org selection, password reset.

**Setup:**

1. WorkOS Dashboard → AuthKit → Enable
2. Configure branding (logo, colors, custom domain)
3. No callback logic changes needed — same redirect flow

**Integration:** Use `provider: 'authkit'` in authorization URL (already done in Step 3).

**When to use:**

- You want branded auth UI without building custom flows
- You need MFA enrollment UI
- You need email verification UI

**When to skip:**

- You have existing custom auth UI you want to preserve
- You need UI customization beyond branding options

## Step 7: Update Stored User Identifiers

### If Using Profile IDs (CRITICAL)

```bash
# Audit: Find all profile_id references
grep -r "prof_" . --include="*.sql" --include="*.js" --include="*.ts"
```

**Migration strategy:**

```
Old user lookup: WHERE workos_profile_id = 'prof_...'
New user lookup: WHERE email = user.email

Add column: workos_user_id (nullable initially)

Migration script:
  For each user with workos_profile_id:
    1. Look up profile.email via standalone SSO API (before deprecation)
    2. Authenticate user via AuthKit using same email
    3. Store new user.id in workos_user_id column
    4. Keep old workos_profile_id for rollback period
```

**Timeline:** Complete before WorkOS deprecates standalone SSO API (check fetched docs for date).

### If Using Email (SIMPLE)

No changes needed. Email remains the same identifier:

```
Old: profile.email → app_user lookup
New: user.email → app_user lookup (unchanged)
```

Verify `user.emailVerified = true` before trusting it.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Confirm no standalone SSO API calls remain
! grep -r "\.sso\.\|\.SSO\." . --include="*.js" --include="*.ts" --include="*.py" --include="*.rb"

# 2. Confirm AuthKit API usage
grep -r "userManagement\|user_management\|UserManagement" . --include="*.js" --include="*.ts" --include="*.py" --include="*.rb"

# 3. Verify callback handles user object (not profile)
grep -r "user\.id\|user\[.id.\]" app/*/callback* || echo "FAIL: Callback still expects profile object"

# 4. Check email is indexed (if using as identifier)
# Run appropriate DB query for your schema:
# SQL: SHOW INDEX FROM users WHERE Column_name = 'email';
# Verify index exists before going to production

# 5. Test auth flow end-to-end
# Manual: Authenticate a user, verify new user.id is stored
```

**Do not mark complete until all checks pass.**

## Error Recovery

### "User ID not found" after authentication

**Root cause:** Application lookup still using `prof_*` IDs.

**Fix:**

1. Check database query — ensure lookup by `user.email` not `user.id`
2. If using user IDs: verify `workos_user_id` column populated
3. Check fetched docs for User object schema — confirm field names match

### "email_verification_required" blocks authentication

**Root cause:** WorkOS requires verified email (security feature).

**Disable path (if not needed):**

1. WorkOS Dashboard → Authentication → Email Verification → Set to "Optional"
2. Users will authenticate immediately without email check

**Keep path (recommended):**

- AuthKit Hosted UI handles it automatically
- Custom UI: show "Check email" message, wait for redirect

### "Authentication code has expired"

**Root cause:** Code exchange took >10 minutes (standard OAuth TTL).

**Fix:**

- Check network latency in callback route
- Ensure callback route isn't retrying failed requests (each code is single-use)
- If using queues/background jobs: process callback immediately, not async

### Build fails with "module not found: userManagement"

**Root cause:** SDK method name varies by language.

**Fix:**

- Check fetched docs for language-specific method name
- Python: `user_management`, TypeScript: `userManagement`, Ruby: `user_management`
- Verify SDK version supports AuthKit (older SDKs may lack `userManagement` domain)

### "organization parameter not working"

**Expected behavior:** If `organization` is provided, user skips org selector.

**Debug:**

1. Verify `organization` value is valid WorkOS org ID (`org_*`)
2. Check org has active SSO connection in Dashboard
3. If using `provider: 'authkit'` + `organization`: user sees that org's SSO only (no password)

### Profile IDs still appear in logs/database

**This is NOT an error during migration period.**

**Action:**

- Maintain both `workos_profile_id` (old) and `workos_user_id` (new) columns
- Use `workos_user_id` for NEW authentications
- Keep `workos_profile_id` for rollback capability
- Remove `workos_profile_id` column after 30-day migration window

### Session invalidated after migration

**Root cause:** Session tied to old Profile ID, now receiving new User ID.

**Fix:**

- Force re-authentication for all users on migration day (clear sessions)
- OR: Map old Profile ID → email → new User ID in session upgrade logic
- Update session storage to use new `user.id` format

## Related Skills

For framework-specific AuthKit implementations:

- `workos-authkit-nextjs` - Next.js App Router integration
- `workos-authkit-react` - React SPA integration
- `workos-authkit-vanilla-js` - Framework-agnostic JavaScript
- `workos-authkit-react-router` - React Router v7 integration
- `workos-authkit-tanstack-start` - TanStack Start integration
