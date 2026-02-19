<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Migration Planning (Decision Tree)

Identify which Firebase auth methods your app currently uses. Each maps to a different WorkOS approach:

```
Current Firebase auth?
  |
  +-- Email/Password --> Step 3: Password Hash Import
  |
  +-- Social (Google/Microsoft/etc) --> Step 4: Social Auth Migration
  |
  +-- Email Link (passwordless) --> Step 5: Magic Auth Setup
  |
  +-- OIDC/SAML (enterprise) --> Step 6: Enterprise SSO
```

Multiple methods can coexist. Complete all applicable steps.

## Step 3: Password Hash Import (If Using Email/Password)

### Phase A: Retrieve Firebase Hash Parameters

**Source:** Firebase Console → Authentication → Users → Export Users (overflow menu)

You need these project-level parameters (NOT per-user):
- `base64_signer_key`
- `base64_salt_separator`
- `rounds`
- `mem_cost`

**Verification:** All four values are base64 strings or integers. If missing, check Firebase console access permissions.

### Phase B: Export User Password Data

Run Firebase CLI command to export user records:

```bash
firebase auth:export users.json --format=JSON
```

**Check export:** Users with passwords have both `passwordHash` and `salt` fields. Users without passwords (social-only) will lack these fields — this is expected.

### Phase C: Convert to PHC Format

Firebase uses a non-standard scrypt variant. WorkOS requires PHC-formatted hashes.

**Mapping:**

```
Firebase parameter       --> PHC parameter name
base64_signer_key        --> sk
base64_salt_separator    --> ss
rounds                   --> (pass through)
mem_cost                 --> (pass through)
```

**Per-user hash format:**

```
$firebase-scrypt$ln={rounds},r=8,p=1$ss={salt_separator}$sk={signer_key}$salt={user_salt}$hash={user_password_hash}
```

All base64 values (salt, hash, sk, ss) must be URL-safe base64 (no padding).

**Critical:** The algorithm ID is `firebase-scrypt` (hyphenated). This tells WorkOS to use the Firebase-compatible scrypt fork.

Check fetched docs for complete PHC string construction rules and SDK methods for user creation with imported hashes.

### Phase D: Import to WorkOS

Use SDK method for creating users with password hashes. See fetched docs for exact signature (varies by language).

**Pattern:**

1. For each Firebase user with `passwordHash` + `salt`
2. Construct PHC string as above
3. Call user creation endpoint with email + PHC hash

**Trap warning:** Do NOT send raw `passwordHash` from Firebase — it must be wrapped in PHC format first.

**Verification command:**

```bash
# After import, test login with known Firebase credentials
# Should succeed without password reset
curl -X POST https://api.workos.com/user_management/authenticate \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -d email="test@example.com" \
  -d password="known_password"
```

If auth fails with correct password, the PHC string is malformed.

## Step 4: Social Auth Migration (If Using Social Providers)

### Supported Providers

WorkOS supports the same OAuth providers Firebase does. You will reuse the SAME client credentials.

**Common providers:**
- Google OAuth → WorkOS Google connection
- Microsoft OAuth → WorkOS Microsoft connection

Check fetched docs for full provider list and any provider-specific setup notes.

### Migration Process

For each Firebase social provider:

1. **Locate credentials in Firebase Console:**
   - Go to Authentication → Sign-in method
   - Find the provider (e.g., Google)
   - Note the Client ID and Client Secret

2. **Add to WorkOS:**
   - Dashboard → Authentication → Connections
   - Create new connection for provider type
   - Enter SAME Client ID + Secret from Firebase

**Critical:** Users do NOT need to re-authorize if credentials match. The OAuth flow continues seamlessly.

**Verification:** Test social login in staging environment. User should not see consent screen (already consented in Firebase).

### Unsupported Providers

If Firebase provider is NOT in WorkOS list, contact support@workos.com. Do NOT attempt custom OAuth — WorkOS may add support faster than you can build it.

## Step 5: Magic Auth Setup (If Using Email Link)

Firebase Email Link ≈ WorkOS Magic Auth (same UX pattern).

**Setup:**

1. Enable Magic Auth in WorkOS Dashboard
2. Replace Firebase `sendSignInLinkToEmail()` calls with WorkOS Magic Auth SDK method
3. Replace Firebase `signInWithEmailLink()` calls with WorkOS callback handler

Check fetched docs for exact SDK methods (vary by language/framework).

**No password import needed** — Magic Auth is stateless per session.

**Verification:**

```bash
# Send magic link in dev environment
# Link should arrive and complete auth without errors
```

## Step 6: Enterprise SSO (If Using OIDC/SAML)

Firebase OIDC/SAML connections transfer directly to WorkOS.

**Migration steps:**

1. **Identify existing Firebase connections:**
   - Firebase Console → Authentication → Sign-in method
   - Note OIDC/SAML provider details

2. **Recreate in WorkOS:**
   - Dashboard → SSO → New Connection
   - Choose OIDC or SAML to match Firebase
   - Enter SAME provider metadata (issuer URL, cert, etc.)

3. **Update redirect URLs:**
   - Firebase: `https://yourapp.firebaseapp.com/__/auth/handler`
   - WorkOS: `https://api.workos.com/sso/oidc/callback/{connection_id}` (exact URL in Dashboard)

4. **Notify enterprise admins:**
   - They must update redirect URLs in THEIR IdP (Okta, Azure AD, etc.)

Check fetched docs for provider-specific connection setup guides (Okta, Azure AD, Google Workspace).

**Trap warning:** Redirect URL change WILL break login until enterprise admin updates IdP. Coordinate timing.

**Verification:**

```bash
# Test enterprise login in staging
# Should complete without user re-enrolling in IdP
```

## Step 7: Update Application Code

Replace Firebase SDK calls with WorkOS SDK equivalents.

**Common mappings:**

```
Firebase method                     --> WorkOS equivalent
signInWithEmailAndPassword()        --> Authenticate endpoint with email/password
signInWithPopup(provider)           --> OAuth authorization URL redirect
onAuthStateChanged()                --> Check session on page load
signOut()                           --> Revoke session endpoint
```

Check fetched docs for SDK methods in your language. Do NOT assume method names match Firebase.

**Critical for SPAs/React:** WorkOS does NOT have a client-side auth listener like `onAuthStateChanged()`. Use server-side session checks instead. See `workos-authkit-react` skill for React-specific patterns.

## Verification Checklist (ALL MUST PASS)

Run these checks BEFORE removing Firebase:

```bash
# 1. WorkOS API key is configured
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key valid" || echo "FAIL: Invalid API key"

# 2. Password users can log in (if applicable)
# Manual test: Use known Firebase credentials in WorkOS login

# 3. Social providers work (if applicable)
# Manual test: Complete OAuth flow, verify no re-consent

# 4. Magic Auth sends email (if applicable)
# Manual test: Request magic link, verify delivery

# 5. Enterprise SSO redirects correctly (if applicable)
# Manual test: Initiate SSO, verify redirect to IdP and back
```

**Do NOT mark complete until ALL applicable tests pass.**

## Error Recovery

### "Invalid password hash" during import

**Root cause:** PHC string is malformed.

**Fix:**
1. Verify `base64_signer_key` and `base64_salt_separator` are URL-safe base64 (no `+` or `/`, no padding `=`)
2. Check algorithm ID is `firebase-scrypt` (hyphenated, not `firebase_scrypt`)
3. Verify per-user `salt` and `hash` fields are NOT empty in Firebase export
4. Try importing ONE test user first to validate format before bulk import

### Social provider shows consent screen after migration

**Root cause:** Client ID/Secret mismatch between Firebase and WorkOS.

**Fix:**
1. Double-check credentials in Firebase Console → Authentication → Sign-in method
2. Verify exact copy (no trailing spaces) in WorkOS Dashboard
3. Check provider type matches (Google vs Google Workspace are different)

### Enterprise SSO fails with "invalid redirect URI"

**Root cause:** Enterprise IdP still has old Firebase redirect URL.

**Fix:**
1. Get exact WorkOS callback URL from Dashboard (contains `connection_id`)
2. Provide URL to enterprise admin
3. Admin updates "Authorized Redirect URIs" in their IdP
4. Test again — may take 5-10 minutes for IdP cache to clear

### Magic Auth emails not sending

**Root cause:** Email domain not verified in WorkOS.

**Fix:**
1. WorkOS Dashboard → Settings → Email
2. Add and verify sending domain (DNS TXT record)
3. Check spam folder if verification email doesn't arrive

### "User not found" after password import

**Root cause:** Email mismatch between Firebase export and login attempt.

**Fix:**
1. Check Firebase export for exact email format (lowercase? dots?)
2. WorkOS is case-insensitive but whitespace-sensitive
3. Verify user creation API calls succeeded (check HTTP 200 responses)

### Build fails with "cannot find module @workos-inc/..."

**Root cause:** SDK not installed.

**Fix:**
```bash
npm install @workos-inc/node  # or appropriate SDK for your stack
```

Check fetched docs for correct package name for your language.

## Related Skills

For post-migration integration patterns:
- workos-authkit-nextjs (Next.js App Router)
- workos-authkit-react (React SPAs)
- workos-authkit-vanilla-js (plain JavaScript)
