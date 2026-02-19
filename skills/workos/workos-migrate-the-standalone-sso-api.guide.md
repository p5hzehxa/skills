<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Identify Current Integration Pattern

Locate your existing standalone SSO API calls:

```
Current codebase search:
  |
  +-- "Get Authorization URL" (SSO API) --> Note all initiation points
  |
  +-- "Get a Profile and Token" (SSO API) --> Note all callback handlers
  |
  +-- Profile ID storage --> Map to user records
```

**Critical mapping:** Profile IDs from standalone SSO API ≠ User IDs from AuthKit. You will need a migration strategy for existing user records.

### User ID Migration Decision Tree

```
Do you use email as unique identifier?
  |
  +-- YES --> AuthKit User.email matches verified email
  |           No user ID mapping needed in database
  |           WorkOS verifies email before auth completes
  |
  +-- NO  --> You have two choices:
              |
              +-- Option A: Add workos_user_id column, keep old profile_id
              |             Map on first AuthKit login by email
              |
              +-- Option B: Migrate all profile_id → user_id in one pass
                            Requires WorkOS support to export mapping
```

**Trap:** Do NOT assume Profile IDs will work with AuthKit APIs. They are different ID spaces.

### Feature Configuration Assessment

Check if your app uses these standalone SSO API features:

- **Organization-level SSO connections** (SAML, OIDC)
- **Domain verification** for auto-routing users
- **Custom state parameters** for preserving app context
- **IdP-initiated flows** (user starts at IdP, lands in your app)

All are supported in AuthKit. Check fetched docs for any behavioral differences.

## Step 3: Switch Authorization Initiation

### Code Location: SSO Start Points

Find calls to standalone SSO API "Get Authorization URL" endpoint.

**Pattern to replace:**

```
Standalone SSO API call with:
  - connection_id OR organization_id OR provider (e.g., "GoogleOAuth")
  - redirect_uri
  - state (optional)
  - domain_hint (optional)

Replace with:
AuthKit "Get Authorization URL" API with same parameters
```

**New capability:** AuthKit supports `provider: "authkit"` — this enables hosted AuthKit UI with email/password and magic links. Use this for users without SSO connections.

Check fetched docs for exact API endpoint and SDK method signature.

### Verification Command

```bash
# Search for old SSO API references
grep -r "sso.*authorization" . --include="*.ts" --include="*.js" || echo "No matches - confirm manually"
```

## Step 4: Switch Callback Handler

### Code Location: OAuth Callback Route

Find your redirect_uri handler that receives `code` and `state` parameters.

**Pattern to replace:**

```
Standalone SSO API "Get a Profile and Token":
  - Exchanges code for Profile object
  - Profile has: id, email, first_name, last_name, connection_id, organization_id

Replace with:
AuthKit "Authenticate" API:
  - grant_type: "authorization_code"
  - code: (from callback URL param)
  - Returns User object (richer than Profile)
```

**CRITICAL differences in User object:**

- `user.id` ≠ old `profile.id` (see Step 2 for migration strategy)
- `user.email` is verified by WorkOS before auth completes
- `user.email_verified` is always true for successful auth
- `user.profile_picture_url` may be present (not in old Profile)
- Connection metadata in `user.connection_id`, `user.organization_id` (same as before)

Check fetched docs for complete User schema and SDK method signature.

### Verification Command

```bash
# Find callback handlers
grep -r "redirect_uri\|callback" . --include="*.ts" --include="*.js" | grep -i "route\|handler"
```

## Step 5: Handle New Authentication Flows

AuthKit introduces security features that may interrupt the authentication flow with challenges. Your callback handler may now receive error responses instead of a User object.

### Error Response Decision Tree

```
Authenticate API response:
  |
  +-- Success (200) --> User object returned, proceed as before
  |
  +-- Email verification required --> User must verify email first
  |                                   WorkOS sends verification email
  |                                   User clicks link, retries auth
  |
  +-- MFA enrollment required --> User must set up 2FA
  |                               (If MFA is enabled in Dashboard)
  |
  +-- Account linking required --> Multiple auth methods for same email
                                   User must confirm account merge
```

**Do you use AuthKit Hosted UI?**

- **YES** → These flows are handled automatically. Users never reach your callback until verified/enrolled. You can ignore error handling for these cases.
- **NO** (custom auth UI) → You MUST handle these error responses and build UI flows for email verification, MFA enrollment, and account linking.

**Opt-out option:** If you don't want these security features, disable them in WorkOS Dashboard → Authentication settings. This restores standalone SSO API behavior (immediate auth, no challenges).

Check fetched docs for exact error response schemas and error codes.

### Verification Command

```bash
# Check if error handling exists
grep -r "email.*verif\|mfa.*enroll\|account.*link" . --include="*.ts" --include="*.js" || echo "No error handling found - add if using custom UI"
```

## Step 6: Enable AuthKit Provider (Optional)

If you want to support users WITHOUT SSO connections (e.g., email/password, magic links), enable AuthKit provider.

**Decision:** Do you have users who should authenticate without SSO?

```
User base:
  |
  +-- ONLY enterprise SSO users --> Skip this step, use connection_id/organization_id
  |
  +-- Mix of SSO + individual users --> Enable AuthKit provider
  |
  +-- ONLY individual users --> Use provider: "authkit" exclusively
```

**To enable:**

1. WorkOS Dashboard → Authentication → Enable AuthKit
2. Configure branding (logo, colors, custom domain)
3. In authorization call, use `provider: "authkit"` instead of connection_id

**Hosted UI benefits:**

- Pre-built email verification flow
- Pre-built MFA enrollment flow
- Pre-built account linking flow
- Automatic CSRF protection
- Mobile-responsive design

Check fetched docs for AuthKit configuration options and custom domain setup.

## Step 7: Session Management Migration

**Framework-specific AuthKit SDKs (Next.js, React, etc.) include session management.** 

If you're migrating to one of these SDKs, configure session settings per the framework's AuthKit skill:

- **Next.js App Router:** workos-authkit-nextjs
- **React SPA:** workos-authkit-react
- **React Router:** workos-authkit-react-router
- **Vanilla JS:** workos-authkit-vanilla-js

If you're using AuthKit API directly (no framework SDK), you are responsible for:

- Storing User object in session after authentication
- Refreshing access tokens before expiry
- Clearing session on logout

Check fetched docs for access token refresh flow and token expiry times.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. Old SSO API calls removed
! grep -r "sso.*profile.*token" . --include="*.ts" --include="*.js" || echo "FAIL: Old SSO API calls still present"

# 2. AuthKit API calls present
grep -r "authkit.*authenticate\|authorization_code" . --include="*.ts" --include="*.js" || echo "FAIL: No AuthKit API calls found"

# 3. User ID migration strategy implemented (if needed)
grep -r "workos_user_id\|user\.id" . --include="*.ts" --include="*.js" || echo "WARNING: Verify user ID migration strategy"

# 4. Application builds
npm run build || yarn build || pnpm build
```

## Error Recovery

### "User ID not found" after migration

**Root cause:** Profile IDs from standalone SSO API don't match User IDs from AuthKit.

**Fix:**

1. If using email as unique ID: Query user by `user.email` instead of `user.id`
2. If using numeric IDs: Implement fallback lookup by email on first AuthKit login, then store `user.id` for future lookups
3. For bulk migration: Contact WorkOS support for Profile ID → User ID mapping export

### "Email verification required" error in production

**Root cause:** AuthKit email verification is enabled in Dashboard, but your app doesn't handle the error flow.

**Fix options:**

1. Use AuthKit Hosted UI (`provider: "authkit"`) — it handles verification automatically
2. Build custom email verification UI using error response details (check fetched docs for schema)
3. Disable email verification in Dashboard (not recommended for production)

### "Invalid grant" error on callback

**Root cause:** Authorization code already used or expired (AuthKit codes expire faster than standalone SSO API codes).

**Fix:**

- Ensure callback handler doesn't retry the same code
- Check for race conditions (duplicate callback requests)
- Verify clock sync between your server and WorkOS

### Connection metadata missing

**Root cause:** User authenticated via `provider: "authkit"` instead of SSO connection.

**Fix:**

- Check `user.connection_id` and `user.organization_id` — they will be null for AuthKit-only users
- Add conditional logic: SSO users have connection metadata, email/password users don't

### "Provider not found" error

**Root cause:** Passing old standalone SSO API provider values that don't exist in AuthKit.

**Fix:**

- Replace generic `provider: "GoogleOAuth"` with `connection_id` for specific org connections
- OR use `provider: "authkit"` for hosted AuthKit UI
- Check fetched docs for supported provider values

## Related Skills

- workos-authkit-nextjs — Next.js App Router integration
- workos-authkit-react — React SPA integration
- workos-authkit-react-router — React Router integration
- workos-authkit-vanilla-js — Framework-agnostic JavaScript integration
