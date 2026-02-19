<!-- refined:sha256:aec7c2c0f8e0 -->

# WorkOS Migration: Standalone SSO API to AuthKit

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/standalone-sso`

This documentation is the source of truth for migration behavior and API contracts. If this skill conflicts with the fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Dependency Verification

Confirm WorkOS SDK is installed:

```bash
# Check package.json or equivalent dependency manifest
grep -r "workos" package.json requirements.txt Gemfile pom.xml 2>/dev/null || echo "FAIL: WorkOS SDK not found"
```

**CRITICAL:** SDK MUST be present before migration begins. If missing, install per framework's package manager.

## Step 3: Migration Strategy (Decision Tree)

```
Do you control the authentication UI?
  |
  +-- NO (want pre-built UI) --> Use AuthKit Hosted UI (provider="authkit")
  |                              Skip to Step 4, use "authkit" provider
  |
  +-- YES (custom UI) --> Direct API integration
                          Continue with Step 4, use existing SSO providers
```

**Key distinction:**
- **AuthKit Hosted UI** handles email verification, MFA enrollment, account linking automatically
- **Direct API** requires your application to handle these flows manually

Check fetched docs for AuthKit Hosted UI setup if choosing that path.

## Step 4: Update SSO Initiation Call

### Find All Initiation Points

Locate all calls to standalone SSO API's "Get Authorization URL" endpoint in your codebase:

```bash
# Search for old API endpoint patterns
grep -r "sso/authorize" . 2>/dev/null
grep -r "GetAuthorizationUrl" . 2>/dev/null
```

### Replace with AuthKit Authorization URL

**Old pattern (standalone SSO API):**
```
POST /sso/authorize
{
  "connection": "conn_123",
  "redirect_uri": "https://yourapp.com/callback",
  "state": "optional_state"
}
```

**New pattern (AuthKit API):**
```
Use SDK method for generating authorization URL with:
- provider: "authkit" (for Hosted UI) OR existing SSO provider ID
- redirect_uri: same callback URL
- state: same state parameter
- connection: same connection ID for SSO
```

**Check fetched docs for exact SDK method signature** — varies by language (e.g., `getAuthorizationUrl`, `get_authorization_url`).

**CRITICAL:** All initiation parameters from standalone SSO API are supported in AuthKit API. Do NOT remove parameters like `connection`, `organization`, or `domain_hint` during migration.

## Step 5: Update Callback Handler

### Locate Callback Route

Find the route handler that receives `code` and `state` query parameters:

```bash
# Common callback patterns
grep -r "redirect_uri" . | grep -v node_modules
grep -r "?code=" . | grep -v node_modules
```

### Replace Profile Exchange with User Authentication

**Old pattern (standalone SSO API):**
```
Exchange code for Profile object via "Get Profile and Token" endpoint
Result: Profile ID, email, name, connection metadata
```

**New pattern (AuthKit API):**
```
Exchange code for User object via "Authenticate" endpoint
Parameters:
  - grant_type: "authorization_code"
  - code: from query parameter
  
Result: User object (NOT Profile object)
```

**Check fetched docs for exact SDK method signature** — varies by language (e.g., `authenticate`, `authenticateWithCode`).

**BREAKING CHANGE — User ID Migration:**

The User object's ID field uses a DIFFERENT identifier than the Profile ID. If your application persists user identifiers:

```
Decision: How does your app identify users?
  |
  +-- By email (unique) --> Use User.email to match existing records
  |                         WorkOS guarantees verified email before auth succeeds
  |
  +-- By Profile ID --> MUST migrate ID references in database
                        Map old Profile IDs to new User IDs using email
                        Check fetched docs for User object schema
```

**Verification command:**

```bash
# Confirm callback handler returns User object, not Profile object
grep -A 10 "authenticate\|Authenticate" your_callback_file.ext | grep -i "user\|profile"
```

If output shows "Profile", migration is incomplete. If shows "User", correct.

## Step 6: Handle New Authentication Flows (CRITICAL)

AuthKit API introduces NEW error conditions that did NOT exist in standalone SSO API:

### Error Handling Decision Tree

```
Does your app use AuthKit Hosted UI (provider="authkit")?
  |
  +-- YES --> AuthKit handles email verification + MFA enrollment automatically
  |           Skip error handling implementation
  |           Verify: AuthKit enabled in WorkOS Dashboard
  |
  +-- NO (direct API) --> MUST implement error handlers for:
                          1. Email verification required
                          2. MFA enrollment required  
                          3. Account linking required
```

### Required Error Handlers (Direct API Only)

If using direct API integration, authenticate endpoint MAY return these responses instead of User object:

1. **Email verification required** — user must verify email before proceeding
2. **MFA enrollment required** — user must enroll in MFA (if org requires it)
3. **Account linking required** — multiple accounts with same email need linking decision

**Check fetched docs for:**
- Exact error response schemas
- Required user actions for each error type
- How to resume authentication after user completes action

**Pattern for error handling:**

```
On authenticate response:
  IF success --> proceed with User object
  ELSE IF email_verification_required --> redirect user to verification flow
  ELSE IF mfa_enrollment_required --> redirect user to MFA enrollment
  ELSE IF account_linking_required --> present linking decision UI
  ELSE --> log unexpected error, fail gracefully
```

### Disabling Advanced Features (Alternative)

If you do NOT want email verification or MFA enforcement:

1. Navigate to WorkOS Dashboard > Authentication section
2. Disable optional security features
3. Document: This reduces security posture — only for compatibility during migration

## Step 7: Update Provider References (If Applicable)

If your application hardcodes SSO provider types (e.g., "GoogleOAuth", "Okta"):

```bash
# Find provider type references
grep -r "provider.*:" . | grep -v node_modules
```

**New provider type available:** `"authkit"` for Hosted UI.

**Decision:** Are you using AuthKit Hosted UI?

- YES → Replace provider identifiers with `"authkit"`
- NO → Keep existing SSO provider identifiers (GoogleOAuth, Okta, etc.) — they still work with AuthKit API

## Step 8: Test Migration with Existing Connections

### Verification Steps (ALL MUST PASS)

Run through complete auth flow for EACH SSO connection type in your app:

```bash
# 1. Initiation succeeds - returns authorization URL
curl -X POST [your_initiation_endpoint] -d '{"connection":"conn_existing"}' | grep -q "authorization_url" && echo "PASS" || echo "FAIL"

# 2. Callback receives code parameter
# (Manual test: Click auth URL, verify redirect includes ?code=)

# 3. Code exchange returns User object (not Profile)
# Check your callback logs or response - should contain user_id field

# 4. User ID is different from old Profile ID
# Compare: old Profile.id vs new User.id for same email address
# They SHOULD NOT match (this confirms migration)

# 5. Application builds without errors
npm run build || ./gradlew build || bundle exec rake build
```

### Migration Verification Checklist

- [ ] All SSO initiation calls use AuthKit authorization endpoint
- [ ] All callback handlers exchange codes for User objects (not Profiles)
- [ ] User ID migration strategy implemented (email matching OR database ID remapping)
- [ ] Error handlers implemented for new flows (email verification, MFA, linking) OR AuthKit Hosted UI enabled
- [ ] Existing SSO connections tested end-to-end (login succeeds)
- [ ] Application builds and deploys successfully

## Error Recovery

### "User ID not found" after migration

**Root cause:** Application searching for old Profile IDs, which no longer exist.

**Fix:**

1. Determine user lookup method: by ID or by email?
2. If by ID: Run database migration mapping Profile IDs → User IDs using email
3. If by email: Update lookup queries to use User.email (already verified by WorkOS)

**Verification command:**

```bash
# Check if codebase searches by profile_id or user_id
grep -r "profile_id\|profileId" . | grep -v node_modules | wc -l
```

If count > 0, profile ID references remain. Update to user_id.

### "Email verification required" error (direct API)

**Root cause:** User email not verified, but your app requires verified emails.

**Fix (choose one):**

1. Implement email verification flow in your UI (check fetched docs for verification API)
2. Switch to AuthKit Hosted UI (handles verification automatically)
3. Disable email verification requirement in WorkOS Dashboard (reduces security)

### "Invalid authorization code" after migration

**Root cause:** Using old SSO endpoint to exchange code instead of AuthKit endpoint.

**Fix:** Verify callback handler calls AuthKit's authenticate endpoint (NOT SSO's get-profile endpoint).

**Verification command:**

```bash
# Check callback uses authenticate, not get-profile
grep -r "authenticate" your_callback_handler.ext || echo "FAIL: Still using old endpoint"
```

### SDK method not found

**Root cause:** SDK version does not include AuthKit methods.

**Fix:** 

1. Check SDK version in dependency manifest
2. Upgrade to latest SDK version supporting AuthKit
3. Check fetched docs for minimum SDK version requirements

### AuthKit provider returns 404

**Root cause:** AuthKit not enabled in WorkOS Dashboard.

**Fix:**

1. Log into WorkOS Dashboard
2. Navigate to Authentication section
3. Enable AuthKit and configure branding/domain
4. Retry with provider="authkit"

## Related Skills

- workos-authkit-react — If using React framework with AuthKit Hosted UI
- workos-authkit-nextjs — If using Next.js App Router with AuthKit Hosted UI  
- workos-authkit-vanilla-js — If implementing custom auth UI with vanilla JavaScript
