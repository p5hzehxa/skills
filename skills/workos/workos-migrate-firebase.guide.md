<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The fetched docs are the source of truth. If this skill conflicts with fetched docs, follow fetched docs.

## Step 2: Pre-Flight Validation

### WorkOS Configuration

- Confirm `WORKOS_API_KEY` exists in environment (starts with `sk_`)
- Confirm `WORKOS_CLIENT_ID` exists in environment (starts with `client_`)
- Confirm WorkOS Dashboard access

### Firebase Export Preparation

**CRITICAL:** You need Firebase Admin access to export user data.

Check Firebase Console access:

- Firebase Console → Project Settings → Service Accounts
- Firebase CLI installed (`firebase --version` succeeds)
- Authenticated to correct project (`firebase projects:list`)

## Step 3: Export Firebase Users

Run Firebase CLI export command:

```bash
firebase auth:export users.json --format=JSON
```

**Output:** `users.json` containing user records with `localId`, `email`, `passwordHash`, `salt`, etc.

Inspect structure before proceeding. Users with password authentication have both `passwordHash` and `salt` fields.

## Step 4: Retrieve Firebase Password Hash Parameters

**Only needed if migrating password-based users.**

Firebase Console → Authentication → Settings (gear icon) → Password Hash Parameters

Copy these values (see fetched docs for exact location):

- `base64_signer_key`
- `base64_salt_separator`
- `rounds`
- `mem_cost`

**Trap:** These are PROJECT-level parameters, not per-user. You fetch them once and apply to all password hashes.

## Step 5: Password Hash Format Conversion (Decision Tree)

```
User has passwordHash field?
  |
  +-- YES --> Convert to PHC format (below)
  |
  +-- NO  --> User uses social/magic auth only (skip to Step 6)
```

### PHC Format Construction

Firebase uses a forked `scrypt` variant. Convert to PHC format:

```
$scrypt$ln={rounds},r={block_size},p=1$ss={base64_salt_separator}$sk={base64_signer_key}${user_salt}${user_passwordHash}
```

**Parameter mapping:**

- Firebase `rounds` → PHC `ln` parameter
- Firebase `mem_cost` → PHC `r` parameter (block size)
- Firebase `base64_salt_separator` → PHC `ss` parameter
- Firebase `base64_signer_key` → PHC `sk` parameter
- Per-user `salt` → appended to PHC string
- Per-user `passwordHash` → appended to PHC string

**Trap:** Firebase exports base64-encoded values. PHC format also uses base64. Do NOT double-encode.

**Verification:** PHC string starts with `$scrypt$` and contains exactly 4 `$` separators.

## Step 6: Import Users to WorkOS

For each user in `users.json`:

1. Determine authentication method (password vs social vs both)
2. Call WorkOS User Creation API with appropriate fields
3. Include PHC-formatted password hash if user has password auth

Check fetched docs for exact API endpoint and request schema.

**Critical fields:**

- `email` (required)
- `email_verified` (map from Firebase `emailVerified`)
- `password_hash` (PHC string from Step 5, if applicable)
- `first_name` / `last_name` (if available in Firebase custom claims)

**Trap:** WorkOS User Creation is idempotent by email. Re-running import on same users is safe.

## Step 7: Social Auth Provider Migration (Decision Tree)

```
Firebase uses social providers?
  |
  +-- Google    --> Configure OAuth Connection in WorkOS Dashboard (use same Client ID/Secret)
  |
  +-- Microsoft --> Configure OAuth Connection in WorkOS Dashboard (use same Client ID/Secret)
  |
  +-- Other     --> Check fetched docs for supported providers
```

### OAuth Credential Transfer

For each social provider Firebase uses:

1. Locate Firebase Console → Authentication → Sign-in method → Provider settings
2. Copy Client ID and Client Secret
3. WorkOS Dashboard → Authentication → Connections → Add Connection → OAuth
4. Paste same credentials

**Trap:** Client Secret regeneration in Firebase breaks WorkOS integration. Copy existing secret, don't regenerate.

**Verification:** Test sign-in with social provider in WorkOS before cutover.

## Step 8: Passwordless / Email Link Migration

Firebase Email Link → WorkOS Magic Auth

Check fetched docs for Magic Auth setup. Key difference:

- Firebase: Email link redirects to app with auth token in URL
- WorkOS: Email link redirects to callback, app exchanges code for session

**Migration strategy:** Update redirect URL handling in app code to use WorkOS callback pattern.

## Step 9: Enterprise SSO Migration (OIDC/SAML)

```
Firebase enterprise connections?
  |
  +-- OIDC --> Create OIDC connection in WorkOS Dashboard
  |           (same IdP, same client credentials)
  |
  +-- SAML --> Create SAML connection in WorkOS Dashboard
  |           (same IdP metadata URL or upload XML)
```

Check fetched docs for OIDC and SAML connection setup procedures.

**Trap:** SAML certificate expiration. If Firebase SAML cert is near expiry, rotate in both Firebase AND WorkOS before cutover.

**Verification per connection:**

- Test SSO login flow in WorkOS Dashboard preview
- Confirm user attributes map correctly (email, name, groups)

## Step 10: Dual-Write Strategy (Recommended)

**Problem:** Cutover downtime if batch import fails or is incomplete.

**Solution:** Dual-write during migration period.

Pattern:

1. User signs in to Firebase (old flow)
2. On successful auth, ALSO create/update user in WorkOS
3. Gradually shift traffic to WorkOS
4. Eventually deprecate Firebase

This requires temporary code to call both auth systems. Remove after full cutover.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Firebase export exists
test -f users.json && echo "PASS" || echo "FAIL: Run firebase auth:export"

# 2. User count matches (adjust for your export)
jq '.users | length' users.json

# 3. Password hash format valid (sample check)
# Should print PHC strings starting with $scrypt$
jq -r '.users[] | select(.passwordHash) | .passwordHash' users.json | head -1

# 4. WorkOS API key valid
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/user_management/users | jq '.data | length'

# 5. Social provider connections exist in WorkOS Dashboard
# (Manual: check Dashboard → Connections shows Google, Microsoft, etc.)
```

## Error Recovery

### "Invalid password hash format"

**Cause:** PHC string malformed or missing required parameters.

Fix:

1. Verify PHC string starts with `$scrypt$`
2. Count `$` separators (should be exactly 4)
3. Check parameter names: `ln`, `r`, `p`, `ss`, `sk`
4. Verify values are NOT double-encoded (should be raw base64 from Firebase)

### "Firebase CLI auth required"

**Cause:** Not authenticated to Firebase project.

Fix:

```bash
firebase login
firebase use --add  # Select project
firebase projects:list  # Verify current project
```

### "Password hash parameters not found"

**Cause:** Firebase Console UI moved or project uses default parameters.

Fix:

- Check fetched docs for updated Console navigation
- Contact Firebase support for parameter export if UI unavailable
- Parameters are immutable per project — safe to cache

### "User already exists" on WorkOS import

**Not an error.** WorkOS User Creation is idempotent by email. Re-importing same user updates record.

### "Social auth redirect mismatch"

**Cause:** OAuth redirect URIs don't match between Firebase and WorkOS.

Fix:

1. Firebase Console → Authentication → Sign-in method → Provider → Authorized redirect URIs
2. WorkOS Dashboard → Connections → OAuth provider → Redirect URI
3. Ensure both lists include your app's callback URL
4. Update OAuth provider settings to whitelist new WorkOS callback URL BEFORE cutover

### "SAML metadata URL unreachable"

**Cause:** IdP metadata endpoint changed or requires auth.

Fix:

- Download SAML metadata XML from IdP admin console
- Upload XML directly to WorkOS instead of using metadata URL
- Check fetched docs for XML upload procedure

### Password login fails after import

**Cause:** Incorrect PHC parameter mapping.

Debug:

1. Verify `rounds` and `mem_cost` match Firebase project settings exactly
2. Check `base64_signer_key` and `base64_salt_separator` were copied correctly (no whitespace)
3. Test with known user password in staging environment first
4. If all imports fail, parameter issue. If some fail, per-user `salt` or `passwordHash` corruption.

## Related Skills

For post-migration integration:

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
