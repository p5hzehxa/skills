<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Identify Integration Points

Locate all code paths that:
- Call standalone SSO API's "Get Authorization URL" endpoint
- Handle OAuth callback with `code` parameter
- Call standalone SSO API's "Get a Profile and Token" endpoint
- Store or reference Profile IDs from standalone SSO API

**Critical:** Profile IDs from standalone SSO API will NOT match User IDs from AuthKit. If your application uses Profile IDs as foreign keys, you need a migration strategy.

### User Identifier Strategy (Decision Tree)

```
How does your app identify users?
  |
  +-- By Profile ID --> CRITICAL: Plan ID migration (see Step 5)
  |                     AuthKit User IDs are different
  |
  +-- By email      --> Safe to migrate directly
  |                     WorkOS verifies email during auth
  |
  +-- By external ID --> Check: Does external_id persist across systems?
                         If yes: Safe. If no: Plan ID migration
```

### Framework Detection

Determine which AuthKit integration you'll use:

```
Project type?
  |
  +-- Next.js App Router (13+) --> Related skill: workos-authkit-nextjs
  |
  +-- React (non-Next.js)      --> Related skill: workos-authkit-react
  |
  +-- React Router             --> Related skill: workos-authkit-react-router
  |
  +-- TanStack Start           --> Related skill: workos-authkit-tanstack-start
  |
  +-- Vanilla JS / Other       --> Related skill: workos-authkit-vanilla-js
  |                                (API-only integration)
```

If using a framework with an AuthKit SDK, **STOP HERE** and follow the framework-specific skill. That skill handles all migration steps in context.

**Only continue if:** You're doing a direct API integration without a framework SDK.

## Step 3: Update Authorization URL Generation

### Locate Initiation Code

Find code that generates SSO authorization URLs. Pattern varies by language:

```
Common patterns to search for:
- "getAuthorizationUrl" (standalone SSO API method)
- "/authorize?provider=" (URL construction)
- "connection=" parameter (SSO connection ID)
```

### Replace Endpoint Call

**Old pattern (standalone SSO API):**
```
SDK method for getting SSO authorization URL
Parameters: connection, redirect_uri, state
```

**New pattern (AuthKit):**
```
SDK method for getting AuthKit authorization URL
Parameters: provider, redirect_uri, state
```

**Parameter mapping:**
- `connection` (standalone SSO API) → `provider` (AuthKit)
- `redirect_uri` stays the same
- `state` stays the same
- NEW option: `provider: "authkit"` enables AuthKit Hosted UI (see Step 7)

Check fetched docs for exact SDK method signature in your language.

### Provider Value Transformation

```
Old standalone SSO API value     --> New AuthKit value
connection_<id>                  --> Use connection_<id> OR organization_<id>
                                     Check fetched docs for provider parameter format
```

**Decision:** If you want WorkOS to handle auth UI (email verification, MFA enrollment), use `provider: "authkit"` instead of a specific connection/organization. This enables AuthKit Hosted UI.

## Step 4: Update Callback Handler

### Locate Callback Code

Find the route/endpoint that handles OAuth redirect. It receives:
- `code` parameter (authorization code)
- `state` parameter (if you passed one)

### Replace Token Exchange Call

**Old pattern (standalone SSO API):**
```
SDK method for "Get a Profile and Token"
Input: code
Output: Profile object with profile_id
```

**New pattern (AuthKit):**
```
SDK method for authenticating with code
Input: code, grant_type: "authorization_code"
Output: User object with user.id
```

Check fetched docs for exact SDK method signature in your language.

### Critical Change: Profile → User Object

**Structure differences:**

| Standalone SSO API (Profile) | AuthKit (User)              |
|------------------------------|----------------------------|
| `profile.id`                 | `user.id` (DIFFERENT VALUE)|
| `profile.email`              | `user.email`               |
| `profile.first_name`         | `user.first_name`          |
| `profile.last_name`          | `user.last_name`           |
| `profile.connection_id`      | Not directly in User object|

**ID mapping trap:** `user.id` from AuthKit will NOT match `profile.id` from standalone SSO API, even for the same person. Do NOT assume they're equivalent.

## Step 5: ID Migration Strategy (CRITICAL)

### If Your App Uses Profile IDs

**Problem:** Existing database records reference old Profile IDs. New AuthKit User IDs are different.

**Solution options:**

#### Option A: Email-Based Reconciliation (Recommended if email is unique)
1. On first AuthKit login, look up user by `user.email`
2. Update stored identifier to `user.id`
3. Email is verified by WorkOS, safe to use as key

#### Option B: Dual-Tracking Period
1. Add new `authkit_user_id` column to user table
2. Keep old `profile_id` column temporarily
3. Populate `authkit_user_id` on next login
4. Deprecate `profile_id` after migration window

#### Option C: External ID Bridging
If your app already uses external identifiers (separate from WorkOS IDs), no code change needed — continue using your external ID system.

**Do NOT:**
- Assume Profile ID == User ID
- Attempt to map IDs 1:1 (no mapping exists)
- Reuse Profile IDs as User IDs

## Step 6: Handle New Authentication Flows

AuthKit may return errors that standalone SSO API didn't:

### Email Verification Required

**Error code:** Check fetched docs for exact error code/type

**Meaning:** User must verify email before completing authentication.

**Handling:**
- If using AuthKit Hosted UI (`provider: "authkit"`): WorkOS handles this automatically — no code change needed
- If using direct API: Display error message, prompt user to check email, retry authentication after verification

### MFA Enrollment Required

**Error code:** Check fetched docs for exact error code/type

**Meaning:** Your WorkOS organization requires MFA, but user hasn't enrolled.

**Handling:**
- If using AuthKit Hosted UI: WorkOS handles this automatically
- If using direct API: Redirect user to MFA enrollment flow

### Account Linking

**Error code:** Check fetched docs for exact error code/type

**Meaning:** User authenticated with a different provider, but email matches existing user.

**Handling:** Check fetched docs for account linking flow details.

### Disabling Advanced Features

If you don't want email verification or MFA challenges:

1. Open WorkOS Dashboard → Authentication section
2. Disable unwanted features
3. AuthKit will no longer return those error types

## Step 7: AuthKit Hosted UI (Optional Upgrade)

**What it is:** Pre-built authentication UI hosted by WorkOS. Handles:
- Email verification prompts
- MFA enrollment
- Account linking
- Error states

**When to use:**
- You don't want to build custom auth UI
- You want consistent UX across auth flows
- You want WorkOS to handle new security features automatically

**How to enable:**

1. WorkOS Dashboard → AuthKit section
2. Enable AuthKit Hosted UI
3. Configure branding (logo, colors, custom domain)
4. Change authorization call to use `provider: "authkit"` (see Step 3)

**Callback changes:** None. Your callback still receives `code` and `state`. The difference is users see WorkOS UI instead of being redirected directly to your IdP.

## Step 8: Configuration Migration

### Dashboard Changes

1. WorkOS Dashboard → Connections (old standalone SSO API connections)
2. Verify connections still work under AuthKit — no migration needed for connections themselves
3. WorkOS Dashboard → Authentication section
4. Review security settings (email verification, MFA requirements)
5. Adjust as needed for your application

### Environment Variables

If following a framework-specific skill, defer to that skill's environment setup.

For direct API integration:
- `WORKOS_API_KEY` (same as before)
- `WORKOS_CLIENT_ID` (same as before)

Check fetched docs for any new required configuration.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Find authorization URL generation code
grep -r "getAuthorizationUrl\|/authorize" . --include="*.ts" --include="*.js"

# 2. Find callback handler
grep -r "code.*redirect_uri\|authorization_code" . --include="*.ts" --include="*.js"

# 3. Check for Profile ID references (potential migration needed)
grep -r "profile\.id\|profile_id" . --include="*.ts" --include="*.js"

# 4. Verify SDK version supports AuthKit
npm list @workos-inc/node || pip show workos || bundle show workos

# 5. Application builds successfully
npm run build || yarn build || make build
```

**If check #3 returns results:** Review Step 5 (ID Migration Strategy) before deploying.

## Error Recovery

### "Invalid provider parameter"

- Check: Using `provider` instead of `connection` in AuthKit authorization call
- Check: Provider value format matches fetched docs (may need `connection_` or `organization_` prefix)
- Check: SDK version supports AuthKit provider types

### "User ID not found in database"

**Root cause:** Profile ID → User ID mismatch (see Step 5)

Fix:
1. Check: Is your app looking up users by old Profile ID?
2. Implement email-based reconciliation (Option A in Step 5)
3. Or add dual-tracking (Option B in Step 5)

### "Email verification required" error not handled

- Check: Is email verification enabled in Dashboard → Authentication?
- Fix Option 1: Use AuthKit Hosted UI (`provider: "authkit"`) — handles automatically
- Fix Option 2: Add error handler for email verification response (see Step 6)
- Fix Option 3: Disable email verification in Dashboard if not needed

### "MFA enrollment required" but no MFA flow

- Check: Is MFA required in Dashboard → Authentication?
- Fix Option 1: Use AuthKit Hosted UI — handles automatically
- Fix Option 2: Build MFA enrollment UI (check fetched docs for flow)
- Fix Option 3: Make MFA optional instead of required in Dashboard

### SDK method not found

- Check: SDK version is recent enough to support AuthKit
- Update SDK: `npm install @workos-inc/node@latest` (or equivalent for your language)
- Check fetched docs for minimum SDK version requirements

### Callback receives error instead of code

- Check: Authorization URL generation is correct (Step 3)
- Check: Redirect URI matches exactly what's configured in WorkOS Dashboard
- Check: User completed authentication flow (didn't close browser)
- Check fetched docs for authentication error types and meanings

### Session/cookie configuration errors

**Do NOT configure session management in this skill.** Session handling is framework-specific.

If you need session configuration, follow the framework-specific AuthKit skill for your stack (see Step 2 decision tree).

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-react-router
- workos-authkit-tanstack-start
- workos-authkit-vanilla-js
