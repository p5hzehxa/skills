<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment

### Identify Authentication Methods in Use

Query your Firebase project to determine which methods are active:

```bash
# Check Firebase Console > Authentication > Sign-in method
# Or export users to see what fields are populated
firebase auth:export users.json --format=json
```

**Decision tree for migration path:**

```
Firebase Auth Method?
  |
  +-- Email/Password --> Import password hashes (see Step 3)
  |
  +-- Google/Microsoft/Apple OAuth --> Migrate social connections (see Step 4)
  |
  +-- Email Link (passwordless) --> Configure Magic Auth (see Step 5)
  |
  +-- OIDC/SAML (enterprise) --> Migrate enterprise connections (see Step 6)
  |
  +-- Phone/Anonymous/Custom --> Check docs - not all methods map directly
```

**Critical:** Firebase supports authentication methods WorkOS may not (e.g., phone auth, anonymous auth). Identify these BEFORE starting migration to plan fallbacks.

### Environment Variables

Confirm these exist in your target environment:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

## Step 3: Password Hash Migration (If Using Email/Password)

### Retrieve Firebase Hash Parameters

**From Firebase Console:**
1. Navigate to Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Check docs for location of hash parameters (base64_signer_key, base64_salt_separator, rounds, mem_cost)

**From Firebase CLI:**

```bash
firebase auth:export users.json --format=json
```

### Export User Data

```bash
firebase auth:export users.json --format=json
```

**Critical fields to extract per user:**
- `passwordHash` (base64 encoded)
- `salt` (base64 encoded)
- `email`
- `emailVerified`

**Trap warning:** Firebase exports contain users WITHOUT passwords (OAuth-only users). Filter these out - they don't need hash migration.

### Format for WorkOS

Firebase uses a custom scrypt variant. You must convert Firebase parameters to PHC format:

**Parameter mapping:**
```
Firebase                --> PHC parameter
base64_signer_key       --> sk
base64_salt_separator   --> ss
rounds                  --> r
mem_cost                --> m
passwordHash            --> hash (per-user)
salt                    --> salt (per-user)
```

**PHC format structure:**
```
$scrypt-firebase$r={rounds},m={mem_cost}$sk={signer_key}$ss={salt_separator}$salt={user_salt}$hash={user_hash}
```

Check fetched docs for exact formatting requirements and example values.

### Import Users with Hashes

Use WorkOS User Management API to create users with password hashes. Check fetched docs for exact endpoint and parameters - this varies by SDK language.

**Pattern (pseudocode):**
```
for each user in firebase_export:
  if user has passwordHash:
    create_user(
      email=user.email,
      email_verified=user.emailVerified,
      password_hash=formatted_phc_string
    )
```

**Verification command:**
```bash
# Test one migrated user can sign in with old password
# (run after creating test user in WorkOS)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d email="test@example.com" \
  -d password="old_firebase_password"
```

## Step 4: Social OAuth Migration

### Retrieve Firebase OAuth Credentials

**From Firebase Console:**
1. Authentication > Sign-in method
2. Click each enabled provider (Google, Microsoft, Apple, etc.)
3. Copy Client ID and Client Secret

**Critical:** You need the SAME credentials Firebase uses. If you regenerate new credentials, users will see re-authorization prompts.

### Configure in WorkOS

Check fetched docs for provider-specific setup guides. Each provider (Google, Microsoft, Apple) has different configuration requirements.

**Pattern:**
1. Navigate to WorkOS Dashboard > Authentication > Social Connections
2. Add connection for each provider
3. Paste Firebase's Client ID and Client Secret
4. Configure redirect URIs (must match your application's callback URLs)

**Trap warning:** Redirect URI mismatches are the #1 cause of OAuth failures. If Firebase used `https://yourapp.com/auth/callback`, WorkOS must use the SAME URL.

### Test Provider Flow

```bash
# Verify each provider returns expected user data
# Use WorkOS test mode to avoid affecting production users
```

**Verification checklist (per provider):**
- [ ] Authorization flow completes without errors
- [ ] User profile data (email, name) matches Firebase
- [ ] Existing users can sign in (not prompted to create new account)

## Step 5: Email Link (Magic Auth) Migration

If Firebase users sign in via email link (passwordless), WorkOS Magic Auth provides equivalent functionality.

### Configuration

Check fetched docs for Magic Auth setup. Key differences from Firebase:

**Firebase Email Link:**
- User clicks link in email
- Redirected to app with auth token
- Token validated by Firebase SDK

**WorkOS Magic Auth:**
- User clicks link in email
- Redirected to callback URL with code
- Code exchanged for session via API

**Migration consideration:** Update email templates to point to WorkOS callback URLs instead of Firebase. Old Firebase links will stop working after migration.

### Email Template Migration

Check fetched docs for customizing Magic Auth emails. You cannot reuse Firebase email templates directly - must be recreated in WorkOS Dashboard.

## Step 6: Enterprise SSO Migration (OIDC/SAML)

### Identify Enterprise Connections

Export list of configured OIDC/SAML providers from Firebase:

```bash
# Firebase Console > Authentication > Sign-in method
# Check for any OIDC or SAML entries
```

### Migrate Connection Configuration

For each enterprise connection, WorkOS needs:
- **OIDC:** Client ID, Client Secret, Discovery URL
- **SAML:** Entity ID, ACS URL, SSO URL, X.509 Certificate

Check fetched docs for OIDC and SAML setup guides - these have provider-specific steps.

**Critical:** Coordinate with enterprise customers. They may need to update redirect URIs in their IdP configuration. Plan maintenance windows.

**Pattern for smooth cutover:**
1. Configure WorkOS connection (do NOT activate yet)
2. Give enterprise customer NEW redirect URIs
3. Customer updates IdP configuration
4. Customer confirms test login works
5. Activate WorkOS connection, deactivate Firebase

**Trap warning:** Do NOT deactivate Firebase connection before WorkOS is tested. If enterprise customers cannot sign in, you will need to roll back.

## Step 7: User Metadata Migration

Firebase stores custom user data in `customClaims` or Firestore. WorkOS uses structured user metadata fields.

### Export Custom Data

```bash
firebase auth:export users.json --format=json
```

Parse `customClaims` field per user.

### Map to WorkOS User Metadata

Check fetched docs for user metadata schema. WorkOS has specific fields (first_name, last_name, etc.) - do NOT invent custom field names without checking docs first.

**Pattern:**
```
Firebase customClaims   --> WorkOS user fields
displayName             --> first_name + last_name (split on space)
photoURL                --> (no direct mapping - store in app database)
roles/permissions       --> (WorkOS has separate RBAC - see User Management docs)
```

**Trap warning:** WorkOS user metadata is NOT the same as Firebase custom claims. Some data may need to move to your application database instead.

## Verification Checklist (ALL MUST PASS)

Run these checks BEFORE deprecating Firebase:

```bash
# 1. Password auth works for migrated user
# (replace with actual test user)
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d email="test@example.com" \
  -d password="known_password"

# 2. OAuth provider redirects to correct callback
echo "Visit: https://api.workos.com/sso/authorize?provider=google&client_id=$WORKOS_CLIENT_ID"

# 3. Magic Auth email delivers
# (test via WorkOS Dashboard > Authentication > Magic Auth > Send Test)

# 4. Enterprise SSO works for test user
# (coordinate with enterprise customer for test login)
```

**Critical:** Test with REAL users before cutover. Staging environment may not catch production-only issues (DNS, firewall rules, etc.).

## Step 8: Update Application Code

### Replace Firebase SDK Calls

Check fetched docs for WorkOS SDK equivalents. Common mappings:

**Firebase → WorkOS pattern (conceptual):**
```
firebase.auth().signInWithEmailAndPassword()  --> WorkOS authenticate endpoint
firebase.auth().currentUser                   --> WorkOS getUser() via session
firebase.auth().onAuthStateChanged()          --> WorkOS session verification
```

Exact method names vary by SDK language - check fetched docs for your language.

### Update Redirect URIs

**Critical:** All OAuth callbacks must change from Firebase URLs to WorkOS URLs.

**Find all hardcoded URLs:**
```bash
grep -r "firebaseapp.com" .
grep -r "identitytoolkit.googleapis.com" .
```

Replace with WorkOS equivalents from fetched docs.

## Step 9: Parallel Run (IMPORTANT)

**Do NOT immediately delete Firebase configuration.** Run both systems in parallel:

**Week 1-2:** WorkOS active, Firebase as fallback
- Monitor WorkOS error rates
- Keep Firebase credentials valid
- Be ready to roll back

**Week 3-4:** Firebase read-only
- Disable Firebase user creation
- All new users go to WorkOS
- Existing users migrate on next login

**After 30 days:** Deprecate Firebase
- Only after confirming ALL active users have migrated
- Export final user list from Firebase for backup

**Verification command:**
```bash
# Compare user counts
firebase auth:export firebase_users.json
# Count users in WorkOS via API
# If counts don't match, investigate missing users
```

## Error Recovery

### "Invalid password hash format"

**Root cause:** PHC string formatting error. Firebase parameters not correctly mapped.

**Fix:**
1. Check `base64_signer_key` is base64-encoded (no URL-safe encoding)
2. Verify parameter order matches WorkOS docs exactly
3. Test with single user before bulk import

### "OAuth redirect URI mismatch"

**Root cause:** WorkOS callback URL doesn't match Firebase configuration.

**Fix:**
1. Check Firebase Console for OLD redirect URIs
2. Use EXACT same URIs in WorkOS configuration
3. If URIs must change, update application code first, THEN WorkOS config

### "User already exists"

**Root cause:** Attempting to import user that was already created (duplicate email).

**Fix:**
1. Query WorkOS for existing user by email
2. If exists, use Update User API instead of Create User
3. Add idempotency check to import script

### "Enterprise SSO login fails after migration"

**Root cause:** Enterprise IdP still configured with Firebase redirect URIs.

**Fix:**
1. Contact enterprise customer
2. Provide NEW WorkOS ACS URL from docs
3. Customer updates IdP configuration
4. Test login before closing ticket

**Critical:** This requires customer action. Provide clear migration documentation to enterprise customers 2 weeks before cutover.

### "Magic Auth emails not delivering"

**Root cause:** WorkOS sending domain not allowlisted by email provider.

**Fix:**
1. Check WorkOS Dashboard > Authentication > Magic Auth > Email Settings
2. Add SPF/DKIM records for WorkOS sending domain
3. Test with multiple email providers (Gmail, Outlook, corporate email)

### "Migrated users cannot sign in with old password"

**Root cause:** Hash parameters incorrect or password hash corrupted during export.

**Fix:**
1. Re-export Firebase user data (source may have been truncated)
2. Verify `passwordHash` and `salt` are base64-encoded strings (not objects)
3. Test PHC formatting with single known-good user
4. Compare hash output against WorkOS docs example

**Last resort:** Trigger password reset for affected users. Do NOT leave users unable to sign in.

## Related Skills

- workos-authkit-nextjs - Integrate WorkOS authentication UI in Next.js
- workos-authkit-react - Integrate WorkOS authentication UI in React
