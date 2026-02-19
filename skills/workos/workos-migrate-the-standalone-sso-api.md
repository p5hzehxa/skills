---
name: workos-migrate-the-standalone-sso-api
description: Migrate to WorkOS from the standalone SSO API.
---

<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This is the source of truth. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Migration Analysis

### Identify Current Integration Points

**Map your existing standalone SSO API calls:**

```
Current code location           --> What to change
─────────────────────────────────────────────────
SSO initiation (login button)  --> Step 3
Application callback handler   --> Step 4
User ID persistence logic       --> Step 5 (CRITICAL)
Error handling for SSO          --> Step 6
```

**Document current state:**
- Where does your app call `GET /sso/authorize`?
- Where does your app call `POST /sso/token`?
- What database fields store WorkOS Profile IDs?
- What error handling exists for SSO failures?

**Decision Tree: Do you control the authentication UI?**

```
Do you want to build custom auth UI?
  |
  +-- YES --> Use AuthKit API directly (this skill)
  |           More control, more implementation work
  |
  +-- NO  --> Use AuthKit Hosted UI instead
              Defer to: workos-authkit-{framework} skill
              Less implementation, pre-built flows
```

If you chose AuthKit Hosted UI, **stop here** and use the appropriate framework-specific AuthKit skill instead. This skill covers direct API integration only.

## Step 3: Replace SSO Initiation Call

### Locate Existing Initiation Code

**Find where your app calls standalone SSO API:**
```bash
# Search for SSO authorization URL generation
grep -r "sso/authorize" . --include="*.{js,ts,py,rb,go,java}"
grep -r "getAuthorizationUrl" . --include="*.{js,ts,py,rb,go,java}"
```

### Replace with AuthKit Authorization API

**Pattern (pseudocode showing WHAT to change, not exact code):**

```
BEFORE (standalone SSO API):
  url = workos.sso.getAuthorizationURL({
    provider: 'GoogleOAuth',
    connection: conn_id,
    redirect_uri: callback_url,
    state: session_state
  })

AFTER (AuthKit API):
  url = workos.userManagement.getAuthorizationURL({
    provider: 'GoogleOAuth',  # Same provider types supported
    connection: conn_id,      # Same parameter
    redirect_uri: callback_url,
    state: session_state
  })
```

**Key change:** Method namespace changes from `sso.X` to `userManagement.X`. Check fetched docs for exact method names in your SDK language.

**Provider types:** All standalone SSO API provider types work identically, PLUS AuthKit adds `provider: 'authkit'` for hosted UI (not covered in this skill).

**No other parameters change** — connection ID, redirect URI, state all work the same way.

## Step 4: Replace Callback Handler

### Locate Existing Callback Code

**Find where your app exchanges authorization codes:**
```bash
# Search for token exchange calls
grep -r "sso/token" . --include="*.{js,ts,py,rb,go,java}"
grep -r "getProfileAndToken" . --include="*.{js,ts,py,rb,go,java}"
```

### Replace with AuthKit Authenticate API

**Pattern (pseudocode showing WHAT to change, not exact code):**

```
BEFORE (standalone SSO API):
  response = workos.sso.getProfileAndToken({
    code: request.params.code
  })
  profile = response.profile
  user_id = profile.id  # Format: prof_xxxxx

AFTER (AuthKit API):
  response = workos.userManagement.authenticateWithCode({
    code: request.params.code
  })
  user = response.user
  user_id = user.id  # Format: user_xxxxx (DIFFERENT ID!)
```

**CRITICAL CHANGE:** You now receive a full `User` object instead of a `Profile` object.

**ID format changes:**
- Old: `prof_01H1234...`
- New: `user_01H5678...`

These are **completely different identifiers** for the same person. Proceed to Step 5 for migration strategy.

## Step 5: Handle User ID Changes (CRITICAL)

**STOP. This step determines data migration strategy.**

### Decision Tree: User Identification Strategy

```
How does your app identify users?
  |
  +-- By Profile/User ID only --> Path A: Remap IDs in database
  |
  +-- By email (unique)       --> Path B: Match by email
  |
  +-- By external ID          --> Path C: Match by external ID
```

### Path A: Remap IDs in Database

**If your database has `workos_profile_id` columns:**

1. Create new `workos_user_id` column (nullable initially)
2. During migration window:
   - First AuthKit login for a user → store both IDs
   - Query by: `WHERE workos_profile_id = X OR workos_user_id = X`
3. After all users migrated → drop `workos_profile_id` column

**SQL pattern (adapt to your schema):**
```sql
ALTER TABLE users ADD COLUMN workos_user_id VARCHAR(255);
CREATE INDEX idx_workos_user_id ON users(workos_user_id);
```

**Application logic during migration:**
```
On successful AuthKit response:
  1. Check if user exists by profile_id (old ID)
  2. If yes: update workos_user_id, keep profile_id for now
  3. If no: check by email (see Path B)
```

### Path B: Match by Email

**If email is unique in your app:**

Use `user.email` to match existing records. WorkOS guarantees email is verified before completing authentication.

**Pattern:**
```
On successful AuthKit response:
  1. Look up user by user.email
  2. If exists: update workos_user_id field
  3. If not: create new user record with user.id
```

**Email verification guarantee:** AuthKit will not return a `User` object until email is verified. If verification is required, you'll receive an error (see Step 6).

### Path C: Match by External ID

**If you previously set `connection_id` or similar external identifier:**

Check fetched docs for `externalId` field availability in User object. Match using that field.

**Pattern:**
```
On successful AuthKit response:
  1. Look up user by user.externalId
  2. Update workos_user_id field
```

## Step 6: Handle New Authentication Flows

**AuthKit introduces new error responses for security features:**

### Email Verification Required

**Error indicator:** Check fetched docs for exact error code (likely `email_verification_required`).

**When it happens:** User's email not yet verified.

**Response pattern:**
```
Error response contains:
  - pending_authentication_token (store this)
  - Next step: user must verify email

After user clicks verification link:
  - Call authenticate again with pending_authentication_token
  - Receives full User object
```

**Implementation pseudocode:**
```
try:
  user = authenticateWithCode(code)
catch EmailVerificationRequired as e:
  token = e.pending_authentication_token
  # Store token in session
  # Show "check your email" UI
  # When user returns from email link:
  user = authenticateWithToken(token)
```

### MFA Enrollment/Challenge

**Error indicator:** Check fetched docs for exact error code (likely `mfa_required`).

**When it happens:** Organization requires MFA but user hasn't enrolled, or needs to complete challenge.

**Response pattern:** Similar to email verification — store pending token, complete flow, re-authenticate.

### Account Linking

**Error indicator:** Check fetched docs for exact error code (likely `account_linking_required`).

**When it happens:** User authenticated via SSO but email matches existing password user (or vice versa).

**Response pattern:** Store pending token, show linking UI, re-authenticate after user confirms.

### Disabling Advanced Features (Optional)

**If your app doesn't need these flows:**

1. Go to WorkOS Dashboard → Authentication section
2. Disable:
   - Email verification requirement
   - MFA enforcement
   - Account linking

**This simplifies error handling** but reduces security posture. Check fetched docs for Dashboard navigation.

## Step 7: Update Error Handling

### Locate Existing SSO Error Handlers

```bash
# Find SSO-specific error handling
grep -r "SSOError\|ProfileNotFound\|InvalidConnection" . --include="*.{js,ts,py,rb,go,java}"
```

### Add AuthKit Error Cases

**Expand error handling to include:**
- Email verification required (Step 6)
- MFA required (Step 6)
- Account linking required (Step 6)
- Invalid authorization code (same as before)
- Connection not found (same as before)

**Pattern:**
```
Handle authenticate response:
  if success:
    proceed with user object
  if email_verification_required:
    show "verify email" flow
  if mfa_required:
    show "enroll MFA" flow
  if account_linking_required:
    show "link accounts" flow
  if invalid_code:
    show "authentication failed" error
```

Check fetched docs for exact error type names and response shapes.

## Step 8: Test Migration Path

### Create Test Connection

1. WorkOS Dashboard → Connections
2. Create test SSO connection (e.g., Google OAuth with test client)
3. Note connection ID for testing

### Test Sequence

**Run these in order, confirm each passes:**

```bash
# 1. Generate authorization URL (new API)
curl -X POST https://api.workos.com/user_management/authorize \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "client_id=$WORKOS_CLIENT_ID" \
  -d "redirect_uri=$REDIRECT_URI" \
  -d "provider=GoogleOAuth"
# Expect: authorization_url in response

# 2. Complete SSO flow manually (browser)
# Visit authorization_url, complete SSO
# Note the 'code' parameter in callback

# 3. Exchange code for user (new API)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"client_id\": \"$WORKOS_CLIENT_ID\",
    \"code\": \"$AUTH_CODE\",
    \"grant_type\": \"authorization_code\"
  }"
# Expect: user object with user.id, user.email
```

### Verify User ID Format

```bash
# Check user ID prefix changed
echo $USER_ID | grep -q "^user_" && echo "PASS: New user ID format" || echo "FAIL: Still using profile ID"
```

### Test Error Flows (If Enabled)

**If email verification is enabled in Dashboard:**

1. Create test user with unverified email
2. Attempt authentication
3. Confirm receives `email_verification_required` error
4. Verify pending_authentication_token is present

**If MFA is enforced:**

1. Attempt authentication with user who hasn't enrolled MFA
2. Confirm receives `mfa_required` error

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration completeness:

```bash
# 1. No standalone SSO API calls remain
! grep -r "sso/authorize\|sso/token\|getProfileAndToken" . --include="*.{js,ts,py,rb,go}" 2>/dev/null || echo "FAIL: Found standalone SSO API calls"

# 2. AuthKit API calls exist
grep -r "user_management/authorize\|user_management/authenticate\|userManagement" . --include="*.{js,ts,py,rb,go}" 2>/dev/null || echo "FAIL: No AuthKit API calls found"

# 3. User ID column exists (adapt table name)
# For SQL databases:
psql -c "\d users" | grep -q "workos_user_id" && echo "PASS: User ID column exists" || echo "FAIL: Missing user ID column"

# 4. Application builds
npm run build || gradle build || mvn compile  # Use your build command
```

**Manual verification:**

- [ ] Test user can complete SSO flow end-to-end
- [ ] User object returned contains expected fields (email, first_name, etc.)
- [ ] User ID is stored correctly in database
- [ ] Repeat logins by same user match existing records
- [ ] Error flows show appropriate UI (if advanced features enabled)

## Error Recovery

### "User ID not found in database" (Post-Migration)

**Root cause:** User authenticated with AuthKit (new user_id) but database lookup uses old profile_id.

**Fix:** Implement Path A or Path B from Step 5. Query must check BOTH old profile_id and new user_id during migration window.

### "Invalid authorization code" (Immediate)

**Root causes:**
1. Code already used (codes are single-use)
2. Code expired (check time between authorization and callback)
3. Client ID mismatch (authorization and authenticate calls must use same client_id)

**Debug:**
```bash
# Verify client_id matches in both calls
echo "Auth URL client_id: $AUTH_CLIENT_ID"
echo "Authenticate client_id: $AUTH_CLIENT_ID"
```

### "Email verification required" (Unexpected)

**Root cause:** Email verification is enabled in Dashboard but your app doesn't handle this flow.

**Immediate fix:** Disable in Dashboard → Authentication → Email Verification (if acceptable for your security requirements).

**Proper fix:** Implement email verification flow from Step 6.

### "Connection not found"

**Root causes:**
1. Connection ID doesn't exist in WorkOS
2. Connection is inactive
3. Wrong environment (test vs. production API keys)

**Debug:**
```bash
# List all connections
curl https://api.workos.com/connections \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

### "Method 'userManagement' not found" (SDK)

**Root cause:** SDK version doesn't support AuthKit API yet.

**Fix:**
1. Check fetched docs for minimum SDK version
2. Update SDK: `npm update @workos-inc/node` (or equivalent for your language)
3. Verify SDK version: Check package.json or equivalent

### Build Fails After Code Changes

**Root causes:**
1. Import paths wrong for SDK version
2. Type mismatches (Profile vs User object fields)
3. Missing error handling for new error types

**Debug:**
```bash
# Check SDK version matches docs requirement
npm list @workos-inc/node  # Node.js example

# Verify imports
grep -n "from '@workos-inc" . -r --include="*.{js,ts}"
```

## Related Skills

- **workos-authkit-nextjs** - For Next.js apps using AuthKit Hosted UI
- **workos-authkit-react** - For React apps using AuthKit Hosted UI  
- **workos-authkit-vanilla-js** - For vanilla JS apps using AuthKit Hosted UI

**Use those skills if:** You want pre-built authentication UI instead of direct API integration.
