<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### API Keys

Check environment variables for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

Verify WorkOS SDK is installed before proceeding.

**Verify:** SDK package exists in node_modules/dependencies before continuing.

## Step 3: User ID Migration Strategy (Decision Tree)

**CRITICAL:** User IDs change when migrating from standalone SSO API to AuthKit. Profile IDs ≠ User IDs.

```
How do you identify users in your application?
  |
  +-- Email is unique identifier
  |     --> Use user.email to map to existing records
  |     --> AuthKit guarantees email verification before auth completes
  |
  +-- Profile ID is stored
        --> Create migration mapping table: old_profile_id -> new_user_id
        --> Backfill during first AuthKit login for each user
        --> Keep both IDs during transition period
```

**Trap warning:** Do NOT assume Profile IDs will remain valid. They are replaced by User IDs in AuthKit responses.

## Step 4: Update Authorization URL Calls

### Current Code Pattern (Standalone SSO API)

Your code currently calls: `workos.sso.getAuthorizationUrl()`

### New Code Pattern (AuthKit)

Replace with: `workos.authkit.getAuthorizationUrl()`

**Parameters remain identical** — all standalone SSO parameters are supported in AuthKit.

**New capability:** AuthKit adds `provider: 'authkit'` option to enable Hosted UI. See fetched docs for when to use this vs. specific providers.

## Step 5: Update Callback Handler

### Current Code Pattern (Standalone SSO API)

Your callback currently:

1. Receives `code` + `state` parameters
2. Calls `workos.sso.getProfileAndToken(code)`
3. Receives a Profile object
4. Extracts `profile.id`, `profile.email`, `profile.first_name`, etc.

### New Code Pattern (AuthKit)

Replace callback logic:

1. Same parameters: `code` + `state`
2. Call `workos.authkit.authenticate(code, grantType: 'authorization_code')`
3. Receives a User object (NOT Profile)
4. Extract `user.id`, `user.email`, `user.firstName`, etc.

**Object structure changes:** Check fetched docs for complete User object schema. Field names may differ (camelCase vs. snake_case, `first_name` vs. `firstName`).

**ID mapping:** If you stored Profile IDs, implement the strategy from Step 3.

## Step 6: Handle New Authentication Errors (CRITICAL)

AuthKit introduces authentication challenges that standalone SSO API did not enforce. Your callback MUST handle these errors:

### Error Types to Handle

Check fetched docs for exact error response schemas. Expect errors for:

- **Email verification required** - user must verify email before completing auth
- **MFA enrollment required** - organization requires multi-factor authentication
- **Account linking** - email exists with different auth method

### Decision Tree: Error Handling Strategy

```
Do you use AuthKit Hosted UI (provider: 'authkit')?
  |
  +-- YES --> Hosted UI handles all errors automatically
  |           No additional error handling needed in callback
  |
  +-- NO  --> You MUST handle error responses in callback
              Redirect user to appropriate challenge flow
              Check fetched docs for error response structure
```

**Trap warning:** If you call AuthKit API directly (not Hosted UI), failing to handle these errors will break user authentication. Test with email verification enabled.

### Disabling Challenges (Optional)

If your application does not require email verification or MFA:

1. Go to WorkOS Dashboard → Authentication section
2. Disable unwanted authentication challenges
3. Verify in test environment before deploying

**Do NOT disable challenges in code** — configuration lives in Dashboard only.

## Step 7: Enable AuthKit Features (Optional)

### Hosted UI Setup

If migrating to AuthKit Hosted UI (recommended):

1. Enable AuthKit in WorkOS Dashboard
2. Configure branding and custom domains
3. Use `provider: 'authkit'` in authorization URL calls

Check fetched docs for Hosted UI configuration details.

### Custom UI (API-Only)

If building custom auth UI:

- Continue using provider-specific initiation (Google, Microsoft, etc.)
- Handle all error responses from Step 6
- Implement email verification and MFA enrollment flows yourself

**Decision:** Hosted UI reduces implementation complexity by 80%. Use it unless you have specific UI requirements.

## Step 8: Session Management Migration

**Framework-specific:** Session configuration varies by framework (Next.js, Express, etc.).

**Instead of baking session details here:** Check the framework-specific AuthKit skill for your stack:

- Next.js: workos-authkit-nextjs
- React: workos-authkit-react
- Vanilla JS: workos-authkit-vanilla-js

Those skills cover session cookies, token refresh, and logout patterns.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Verify API keys are set
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: API keys missing"

# 2. Verify SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 3. Check authorization URL calls updated
grep -r "sso.getAuthorizationUrl" . && echo "FAIL: Found old SSO calls" || echo "PASS: No old SSO calls"

# 4. Check callback handler updated
grep -r "sso.getProfileAndToken" . && echo "FAIL: Found old profile calls" || echo "PASS: No old profile calls"

# 5. Check for Profile ID references (may need migration)
grep -r "profile\.id" . && echo "WARNING: Profile ID references found - verify User ID migration"
```

**If check #5 shows results:** Go back to Step 3 and implement User ID migration strategy.

## Error Recovery

### "User ID not found in database"

**Root cause:** Profile IDs were stored, but User IDs are now returned.

Fix:

1. Implement Step 3 migration strategy
2. Create mapping table or switch to email-based lookup
3. Backfill user records on first AuthKit login

### "Email verification required" error in callback

**Root cause:** Email verification enabled but error not handled.

Fix options:

1. Switch to AuthKit Hosted UI (`provider: 'authkit'`) — it handles this automatically
2. Or implement email verification flow in your callback
3. Or disable email verification in Dashboard (not recommended for production)

### "Invalid grant" or "Code expired"

**Root cause:** Calling wrong authenticate endpoint or code used twice.

Fix:

1. Verify using `workos.authkit.authenticate()` not old SSO method
2. Ensure code is only exchanged once per callback
3. Check callback URL matches Dashboard configuration exactly

### "Profile object fields missing"

**Root cause:** User object structure differs from Profile object.

Fix:

1. Check fetched docs for User object schema
2. Update field access: `profile.first_name` → `user.firstName` (example)
3. Handle optional fields (User object may have null values)

### Build fails after migration

- Check: All SSO API imports replaced with AuthKit imports
- Check: No lingering references to `profile.id` without migration logic
- Check: SDK version supports AuthKit API (may need upgrade)

## Related Skills

- workos-authkit-nextjs - Next.js integration patterns
- workos-authkit-react - React integration patterns
- workos-authkit-vanilla-js - Framework-agnostic integration
