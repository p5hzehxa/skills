<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

This documentation is the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Migration Planning (Decision Tree)

Identify which Firebase auth features your application currently uses:

```
Firebase Auth Features
  |
  +-- Email/Password --> Section 3: Password Hash Import
  |
  +-- Social Providers (Google, Microsoft, etc.) --> Section 4: Social Auth Migration
  |
  +-- Email Link (Passwordless) --> Section 5: Magic Auth Setup
  |
  +-- OIDC/SAML (Enterprise SSO) --> Section 6: Enterprise Auth Migration
  |
  +-- Multiple features --> Follow all relevant sections
```

**Action:** List which sections apply to your migration before proceeding.

## Step 3: Password Hash Import (Email/Password Users)

### Retrieve Firebase Project Parameters

**CRITICAL:** Firebase uses a custom scrypt variant. You need project-wide parameters before exporting user data.

1. Open Firebase Console → Authentication → Users → Three-dot menu → Password hash parameters
2. Record these exact values (you'll need them for EVERY user):
   - `base64_signer_key`
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

### Export User Data

Run Firebase CLI command to export users with password hashes:

```bash
firebase auth:export users.json --format=JSON
```

**Verify:** `users.json` contains users with both `passwordHash` and `salt` fields.

### Format Password Hashes (PHC String Pattern)

For EACH user with a password, construct a PHC-compatible hash string:

```
Pattern:
$firebase-scrypt$sk={base64_signer_key}$ss={base64_salt_separator}$r={rounds}$m={mem_cost}$s={user.salt}$h={user.passwordHash}

Example pseudocode:
phcHash = `$firebase-scrypt$sk=${projectKey}$ss=${projectSeparator}$r=${projectRounds}$m=${projectMemCost}$s=${user.salt}$h=${user.passwordHash}`
```

**Critical parameter mapping:**
- Firebase `base64_signer_key` → PHC `sk`
- Firebase `base64_salt_separator` → PHC `ss`
- Firebase `rounds` → PHC `r`
- Firebase `mem_cost` → PHC `m`
- User `salt` → PHC `s`
- User `passwordHash` → PHC `h`

### Import to WorkOS

Use the User Creation or Update API with the formatted hash. Check fetched docs for exact endpoint and parameter names.

**Pattern:**
```
For each user in users.json:
  POST to WorkOS user creation endpoint
  Include:
    - email
    - password_hash: {formatted PHC string}
    - other user fields as needed
```

**Verification command:**
```bash
# After import, test auth for migrated user
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d "email=test@example.com" \
  -d "password=original_password"
```

Should return user object if hash import succeeded.

## Step 4: Social Auth Migration (Google, Microsoft, etc.)

### Locate Firebase OAuth Credentials

For each social provider you use:

1. Open Firebase Console → Authentication → Sign-in method
2. Click on provider (e.g., "Google")
3. Record:
   - OAuth Client ID
   - OAuth Client Secret

**CRITICAL:** These are the SAME credentials you'll give to WorkOS. Do not create new OAuth apps unless necessary.

### Configure in WorkOS Dashboard

Navigate to: WorkOS Dashboard → Authentication → Social Connections

For each provider:

1. Click "Add Connection" → Select provider type
2. Paste Firebase OAuth Client ID
3. Paste Firebase OAuth Client Secret
4. Save configuration

**Decision tree for redirect URIs:**

```
Redirect URI handling
  |
  +-- Using AuthKit --> WorkOS handles redirect automatically
  |
  +-- Custom OAuth flow --> Update redirect URI in OAuth provider console
                            to point to WorkOS callback endpoint
                            (check fetched docs for exact URL pattern)
```

**Verification:** Check WorkOS Dashboard shows "Active" status for each connection.

### Supported Providers

Check fetched documentation for current list. If you need a provider not listed:

- Email support@workos.com with provider name
- Do NOT proceed with custom OAuth implementation — wait for WorkOS support

## Step 5: Magic Auth Setup (Email Link Replacement)

If Firebase Email Link was enabled, migrate to WorkOS Magic Auth.

### Enable Magic Auth

WorkOS Dashboard → Authentication → Magic Auth → Enable

### Update Application Code

Replace Firebase `sendSignInLinkToEmail` calls with WorkOS Magic Auth email sending. Check fetched docs for SDK method names.

**Pattern:**
```
Firebase:
  sendSignInLinkToEmail(email, actionCodeSettings)

WorkOS equivalent:
  SDK method to send magic link email (check fetched docs for exact method)
  Include: email, redirect URL after auth
```

### Callback Handling

Replace Firebase `signInWithEmailLink` with WorkOS session creation. Check fetched docs for callback handling.

**Verification command:**
```bash
# Test magic link flow
# 1. Trigger magic link send via your app
# 2. Check email received
# 3. Click link, verify redirect completes
# 4. Check user session created
```

## Step 6: Enterprise Auth Migration (OIDC/SAML)

### Inventory Enterprise Connections

List all organizations using Firebase OIDC or SAML:

```bash
# Export Firebase auth config to identify OIDC/SAML tenants
firebase auth:export auth-config.json --format=JSON
```

Identify entries with:
- `providerId` starting with `oidc.` or `saml.`

### Migrate Each Connection

For EACH enterprise connection:

1. Record from Firebase config:
   - Provider type (OIDC or SAML)
   - Identity provider metadata/endpoints
   - Client ID (OIDC) or Entity ID (SAML)
   - Client Secret (OIDC) or Certificate (SAML)

2. Create in WorkOS:
   - WorkOS Dashboard → Connections → Add Connection
   - Select organization
   - Choose OIDC or SAML
   - Input provider details

3. Update Identity Provider:
   - Change ACS URL (SAML) or Redirect URI (OIDC) to WorkOS endpoints
   - Check fetched docs for WorkOS callback URL patterns

**Decision tree for metadata handling:**

```
Identity Provider Setup
  |
  +-- SAML --> Requires XML metadata or manual field entry
  |            Check fetched docs for required SAML fields
  |
  +-- OIDC --> Requires discovery endpoint or manual configuration
               Check fetched docs for required OIDC fields
```

**Verification per connection:**
```bash
# Test enterprise SSO flow
# 1. Navigate to your app's login for this organization
# 2. Click enterprise SSO button
# 3. Should redirect to IdP
# 4. Sign in at IdP
# 5. Should redirect back to app with session
```

## Step 7: User Data Migration (All Migration Types)

### Export Additional User Fields

Beyond auth credentials, export user profile data:

```bash
firebase auth:export users.json --format=JSON
```

### Map Firebase Fields to WorkOS

Check fetched docs for WorkOS user schema. Common mappings:

- `uid` → Track in your database, not directly mappable
- `email` → WorkOS email field
- `displayName` → WorkOS first_name/last_name (requires splitting)
- `photoURL` → Store in custom user metadata
- `emailVerified` → WorkOS email_verified field
- Custom claims → WorkOS user metadata or roles (check fetched docs)

### Import User Records

Use WorkOS User Creation API for each user. Check fetched docs for bulk import options.

**Pattern:**
```
For each user in users.json:
  POST to WorkOS user creation
  Include:
    - email (required)
    - email_verified
    - first_name, last_name (from displayName)
    - password_hash (if from Section 3)
    - metadata: {
        firebase_uid: uid,
        photo_url: photoURL,
        custom_field: customClaims.field
      }
```

## Step 8: Update Application Code

### Replace Firebase SDK Calls

**Decision tree for AuthKit integration:**

```
Application Framework
  |
  +-- Next.js App Router --> Use workos-authkit-nextjs skill
  |
  +-- React (any router) --> Use workos-authkit-react skill
  |
  +-- Vanilla JS --> Use workos-authkit-vanilla-js skill
  |
  +-- React Router --> Use workos-authkit-react-router skill
  |
  +-- TanStack Start --> Use workos-authkit-tanstack-start skill
  |
  +-- Other --> Use workos-authkit-base skill for API integration
```

### Common Firebase → WorkOS Mappings

Check fetched docs for exact SDK method names. General patterns:

- `firebase.auth().signInWithEmailAndPassword()` → WorkOS password auth method
- `firebase.auth().signInWithPopup()` → WorkOS social auth method
- `firebase.auth().sendSignInLinkToEmail()` → WorkOS magic auth method
- `firebase.auth().onAuthStateChanged()` → WorkOS session check method
- `firebase.auth().signOut()` → WorkOS sign out method

### Environment Variables

Update your `.env`:

```bash
# Remove Firebase config
# FIREBASE_API_KEY=...
# FIREBASE_AUTH_DOMAIN=...
# FIREBASE_PROJECT_ID=...

# Add WorkOS config
WORKOS_API_KEY=sk_...
WORKOS_CLIENT_ID=client_...
```

**Verification command:**
```bash
# Check env vars set correctly
grep "WORKOS_API_KEY" .env && grep "WORKOS_CLIENT_ID" .env || echo "FAIL: WorkOS env vars missing"
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm migration. **Do not mark complete until all pass:**

```bash
# 1. WorkOS environment variables configured
grep "WORKOS_API_KEY" .env | grep "sk_" || echo "FAIL: API key not set"
grep "WORKOS_CLIENT_ID" .env | grep "client_" || echo "FAIL: Client ID not set"

# 2. Firebase SDK removed (optional but recommended)
grep -r "firebase/auth" src/ && echo "WARN: Firebase SDK still imported" || echo "PASS: Firebase SDK removed"

# 3. Test password auth for migrated user (if applicable)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test_password"}' \
  | grep -q "user" && echo "PASS: Password auth works" || echo "FAIL: Password auth broken"

# 4. Test social auth configured (if applicable)
# Manual: Attempt social login via WorkOS Dashboard preview

# 5. Application builds successfully
npm run build || echo "FAIL: Build broken"
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC string formatting error in password import.

**Fix:**
1. Verify parameter mapping matches Section 3 exactly
2. Check no spaces or newlines in PHC string
3. Confirm base64 values not modified during copy
4. Validate with sample user before bulk import

### "OAuth client ID mismatch"

**Root cause:** Different OAuth app used in WorkOS vs Firebase.

**Fix:**
1. Verify Client ID in WorkOS Dashboard matches Firebase Console exactly
2. If redirect URI changed, update OAuth provider console (Google/Microsoft)
3. Check OAuth app not restricted to Firebase domains

### "SAML assertion invalid"

**Root cause:** ACS URL not updated in Identity Provider.

**Fix:**
1. Check fetched docs for WorkOS ACS URL format
2. Update IdP configuration with WorkOS ACS URL
3. Verify EntityID matches between IdP and WorkOS
4. Re-upload metadata if using XML-based config

### "User not found" after migration

**Root cause:** User import incomplete or failed.

**Fix:**
1. Check WorkOS Dashboard → Users for imported count
2. Verify API responses during import (look for 4xx/5xx)
3. Check required fields (email) not missing in import payload
4. Re-run import for failed users

### Build fails with Firebase SDK errors

**Root cause:** Firebase SDK calls not replaced.

**Fix:**
1. Search codebase: `grep -r "firebase" src/`
2. Replace remaining Firebase auth calls with WorkOS equivalents
3. Remove Firebase SDK: `npm uninstall firebase`
4. Clear build cache: `rm -rf .next` or equivalent

### Social auth redirects to Firebase

**Root cause:** OAuth redirect URI not updated.

**Fix:**
1. Open OAuth provider console (Google/Microsoft/etc.)
2. Update Authorized Redirect URIs to WorkOS callback URL
3. Check fetched docs for WorkOS callback URL pattern
4. Test social auth flow after update

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
- workos-authkit-react-router
- workos-authkit-tanstack-start
- workos-authkit-base
