---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The fetched docs are the source of truth for behavioral claims. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Migration Assessment

Answer these questions before writing code:

### Authentication Methods Inventory

Audit your Firebase project to determine which auth methods are active:

```bash
# Export Firebase users to see auth methods
firebase auth:export users.json --format=JSON

# Check for password users (look for passwordHash field)
grep -c "passwordHash" users.json

# Check for social providers (providerUserInfo array)
grep "providerUserInfo" users.json | head -5
```

Create a checklist:
- [ ] Password authentication (passwordHash present)
- [ ] Google Sign-In (google.com provider)
- [ ] Microsoft Sign-In (microsoft.com provider)
- [ ] Email Link / Magic Link
- [ ] OIDC connections
- [ ] SAML connections

**Decision tree for migration strategy:**

```
Auth method?
  |
  +-- Passwords --> Go to Step 3 (Password Hash Import)
  |
  +-- Social (Google/Microsoft) --> Go to Step 4 (Social Provider Setup)
  |
  +-- Email Link --> Go to Step 5 (Magic Auth Migration)
  |
  +-- OIDC/SAML --> Go to Step 6 (Enterprise Auth Migration)
```

Most Firebase projects use multiple methods — complete ALL relevant steps.

## Step 3: Password Hash Import (If Using Firebase Passwords)

Firebase uses a proprietary scrypt variant. WorkOS accepts these hashes directly during user creation or update.

### Step 3a: Retrieve Firebase Hash Parameters

```
Firebase Console flow:
  Authentication > Users > ⋮ menu > Password hash parameters
```

Save these FOUR values (you need all four):
- `base64_signer_key` (long base64 string)
- `base64_salt_separator` (short base64 string)
- `rounds` (number, typically 8)
- `mem_cost` (number, typically 14)

**CRITICAL:** These are PROJECT-level parameters. They are the same for all users in a Firebase project.

### Step 3b: Export User Password Data

```bash
# Export with Firebase CLI (requires Firebase Admin access)
firebase auth:export users.json --format=JSON --project YOUR_PROJECT_ID
```

For each user with password auth, you need:
- `passwordHash` (per-user, base64)
- `salt` (per-user, base64)

Users without these fields use social auth only — skip password import for them.

### Step 3c: Convert to PHC Format

WorkOS requires PHC-formatted hashes. Convert Firebase parameters to PHC:

```
PHC Format (pseudocode pattern):
$firebase-scrypt$sk={base64_signer_key}$ss={base64_salt_separator}$r={rounds}$m={mem_cost}$s={user_salt}${user_passwordHash}
```

**Parameter mapping:**
```
Firebase              --> PHC parameter
base64_signer_key     --> sk
base64_salt_separator --> ss
rounds                --> r
mem_cost              --> m
user salt             --> s
user passwordHash     --> (hash body)
```

Check fetched docs for exact PHC string format requirements.

### Step 3d: Import to WorkOS

Use User Management API to create users with imported hashes.

**Pseudocode pattern:**
```
For each Firebase user with password:
  1. Format PHC hash string using project params + user salt/hash
  2. POST to /user_management/users with:
     - email
     - password_hash (the PHC string)
     - first_name, last_name (if available)
  3. Store mapping: firebase_uid -> workos_user_id
```

Check fetched docs for exact API endpoint and request schema.

**CRITICAL TRAP:** The `password_hash` field expects the FULL PHC string including the `$firebase-scrypt$` prefix. Do not send raw base64.

## Step 4: Social Provider Migration (If Using Google/Microsoft OAuth)

Firebase social auth uses OAuth client credentials. WorkOS needs the SAME credentials to preserve user identity.

### Step 4a: Extract Firebase OAuth Credentials

```
Firebase Console flow:
  Authentication > Sign-in method > [Provider] > Configuration
```

For EACH enabled social provider, retrieve:
- Client ID
- Client Secret

**CRITICAL:** Use the EXACT same credentials. New credentials = different provider user IDs = orphaned accounts.

### Step 4b: Configure in WorkOS Dashboard

```
WorkOS Dashboard flow:
  Connections > + New Connection > OAuth
```

Select provider (Google, Microsoft, etc.) and enter the Firebase credentials.

**Verification command:**
```bash
# Test OAuth flow with WorkOS connection
curl "https://api.workos.com/sso/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK&response_type=code&provider=GoogleOAuth&connection_id=CONNECTION_ID"
```

Expected: Redirect to Google OAuth consent screen (not WorkOS error page).

### Step 4c: User Identity Mapping

**CRITICAL TRAP:** Firebase stores provider user IDs (e.g., Google UID). WorkOS does NOT automatically link these.

**Pattern for migration:**
```
For each Firebase user with social auth:
  1. Extract providerUserInfo[].providerId (e.g., "google.com")
  2. Extract providerUserInfo[].rawId (the Google/Microsoft user ID)
  3. When user signs in via WorkOS OAuth:
     - Fetch WorkOS user profile
     - Check if profile.connection_id matches expected provider
     - Check if profile.raw_attributes.sub matches Firebase rawId
     - If match: Link to existing app account
     - If no match: Create new account OR error (depends on your UX)
```

Check fetched docs for exact profile schema returned by OAuth flow.

## Step 5: Email Link / Magic Auth Migration

Firebase Email Link ≈ WorkOS Magic Auth. No direct migration of "links" is possible (they expire), but UX is equivalent.

### Step 5a: Configure Magic Auth

```
WorkOS Dashboard flow:
  Configuration > Authentication Methods > Magic Auth > Enable
```

Set email template branding to match Firebase's look (optional but reduces user confusion).

### Step 5b: Update Application Code

Replace Firebase `sendSignInLinkToEmail` with WorkOS Magic Auth API.

**Pseudocode pattern:**
```
Old Firebase pattern:
  firebase.auth().sendSignInLinkToEmail(email, actionCodeSettings)

New WorkOS pattern:
  1. POST to /passwordless/sessions with email
  2. WorkOS sends magic link email
  3. User clicks link -> callback URL with code
  4. Exchange code for session (check fetched docs for exact endpoint)
```

**CRITICAL:** Magic Auth codes expire (check fetched docs for TTL). Implement code expiry error handling.

## Step 6: Enterprise Auth (OIDC/SAML) Migration

Firebase OIDC/SAML connections can be recreated in WorkOS with identical configurations.

### Step 6a: Export Firebase Connection Settings

```
Firebase Console flow:
  Authentication > Sign-in method > [SAML/OIDC Provider] > Configuration
```

For EACH enterprise connection, save:
- **SAML:** Entity ID, SSO URL, X.509 Certificate
- **OIDC:** Issuer URL, Client ID, Client Secret

### Step 6b: Recreate in WorkOS

```
WorkOS Dashboard flow:
  Connections > + New Connection > SAML (or OIDC)
```

Enter the EXACT same values. Do not change Entity IDs or Issuer URLs — identity providers use these to route requests.

**Verification command:**
```bash
# Test SAML connection
curl -I "https://api.workos.com/sso/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK&response_type=code&connection_id=SAML_CONNECTION_ID"
```

Expected: HTTP 302 redirect to IdP login page.

### Step 6c: Update ACS URLs (CRITICAL)

SAML Assertion Consumer Service (ACS) URLs change from Firebase to WorkOS.

**Action required:**
```
In identity provider config (Okta, Azure AD, etc.):
  Old ACS URL: https://YOUR_PROJECT.firebaseapp.com/__/auth/handler
  New ACS URL: https://api.workos.com/sso/saml/acs/CONNECTION_ID
```

Get exact ACS URL from WorkOS Dashboard after creating connection.

**CRITICAL TRAP:** If you don't update ACS URL in IdP, SAML assertions will fail with "invalid destination" error.

## Step 7: User Data Migration (Non-Auth Fields)

Firebase stores custom user data (displayName, photoURL, claims). Migrate these to WorkOS User Management.

**Pseudocode pattern:**
```
For each Firebase user:
  1. Extract user metadata (displayName, photoURL, customClaims)
  2. If user already created in Step 3 (password import):
     - PATCH /user_management/users/{id} to add metadata
  3. If user not yet created (social auth only):
     - Create user record with POST /user_management/users
     - Store Firebase UID in metadata for reconciliation
```

Check fetched docs for exact metadata field names and size limits.

## Step 8: Cutover Strategy

**DO NOT flip all users at once.** Use phased rollout:

```
Phase 1: Parallel run (recommended)
  - Keep Firebase auth active
  - Add WorkOS auth as alternative
  - Users can sign in via either
  - Track which users migrate organically

Phase 2: Gradual enforcement
  - Force WorkOS auth for NEW users
  - Prompt existing Firebase users to migrate on next login
  - Keep Firebase as fallback for 30 days

Phase 3: Firebase shutdown
  - Disable Firebase auth methods
  - All users on WorkOS
```

**Rollback plan:**
If WorkOS auth fails, re-enable Firebase auth methods immediately (reverse Step 8 Phase 3).

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration readiness:

```bash
# 1. Check WorkOS SDK installed
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"

# 2. Verify env vars set
[ -n "$WORKOS_API_KEY" ] && echo "PASS: API key set" || echo "FAIL: Missing WORKOS_API_KEY"
[ -n "$WORKOS_CLIENT_ID" ] && echo "PASS: Client ID set" || echo "FAIL: Missing WORKOS_CLIENT_ID"

# 3. Test WorkOS API connectivity
curl -f -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" \
  && echo "PASS: API reachable" || echo "FAIL: API error"

# 4. Check Firebase export complete
[ -f users.json ] && echo "PASS: Firebase export exists" || echo "FAIL: Run firebase auth:export"

# 5. Verify password hash parameters retrieved
grep -q "base64_signer_key" firebase_params.json 2>/dev/null \
  && echo "PASS: Hash params saved" || echo "FAIL: Export hash parameters from Firebase Console"

# 6. Test OAuth connection (replace CONNECTION_ID)
curl -f "https://api.workos.com/sso/authorize?client_id=$WORKOS_CLIENT_ID&redirect_uri=http://localhost:3000/callback&response_type=code&provider=GoogleOAuth&connection_id=CONNECTION_ID" \
  && echo "PASS: OAuth configured" || echo "FAIL: Configure OAuth in Dashboard"
```

**If check #4 fails:** You need Firebase Admin access. Request from project owner.

**If check #6 fails:** Double-check client credentials match Firebase exactly.

## Error Recovery

### "Invalid password hash format" during user import

**Root cause:** PHC string malformed or missing required parameters.

**Fix:**
1. Verify PHC string starts with `$firebase-scrypt$`
2. Check all FOUR project parameters are present: sk, ss, r, m
3. Verify user salt (`s=`) is included
4. Check for encoding issues (base64 should not have spaces/newlines)

**Debug command:**
```bash
# Print first imported hash to inspect format
echo "USER_PHC_HASH_HERE" | grep -o '\$[^$]*' | head -6
```

Expected output: Six `$`-delimited segments.

### "User already exists" error during import

**Root cause:** Email collision — user with that email already in WorkOS.

**Decision tree:**
```
Email collision?
  |
  +-- Same person --> PATCH existing user to add password hash
  |
  +-- Different person --> This is a data quality issue; manually resolve
```

Most common cause: You ran import script twice. Use upsert logic (check if user exists before POST).

### OAuth sign-in creates new account instead of linking existing

**Root cause:** WorkOS cannot auto-match OAuth profile to imported password account.

**Fix:**
Implement email-based account linking:
```
OAuth callback handler pseudocode:
  1. Get email from OAuth profile
  2. Check if user with email exists in your DB
  3. If exists:
     - Link WorkOS user_id to existing account
     - Mark "migrated from Firebase"
  4. If not exists:
     - Create new account
```

**CRITICAL:** Require email verification before linking to prevent account takeover.

### SAML SSO fails with "invalid destination"

**Root cause:** ACS URL in IdP config still points to Firebase.

**Fix:**
1. Get WorkOS ACS URL from Dashboard (Connections > [Connection] > ACS URL)
2. Update ACS URL in identity provider (Okta, Azure AD, etc.)
3. Save IdP config changes
4. Test SAML flow again (can take 5-10 min for IdP cache to clear)

### Magic Auth email not received

**Root cause 1:** Email template not configured or blocked by spam filter.
**Fix:** Check WorkOS Dashboard > Emails > Magic Auth > Preview/Test. Send test email.

**Root cause 2:** Rate limit hit (too many emails to same address).
**Fix:** Check fetched docs for Magic Auth rate limits. Wait 60 seconds between attempts.

### Firebase users lost custom claims after migration

**Root cause:** Custom claims are not migrated automatically — they're separate from auth.

**Fix:**
1. Export Firebase custom claims: `firebase auth:export` includes `customClaims` field
2. Store custom claims in WorkOS user metadata or your own DB
3. Rebuild custom claims logic using WorkOS User Management API

Check fetched docs for metadata field limits (may be smaller than Firebase).

## Related Skills

- workos-authkit-nextjs — for adding WorkOS auth UI after migration
- workos-authkit-react — for React-based post-migration integration
