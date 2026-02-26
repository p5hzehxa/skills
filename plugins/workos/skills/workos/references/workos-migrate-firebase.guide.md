<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Migration Path Decision Tree

```
What Firebase auth methods does your app use?
  |
  +-- Passwords only
  |     --> Import password hashes (Step 3)
  |     --> Skip to Step 6 (User Migration)
  |
  +-- Social providers (Google, Microsoft, etc.)
  |     --> Configure OAuth connections (Step 4)
  |     --> Skip password import
  |
  +-- Email Link (passwordless)
  |     --> Enable Magic Auth (Step 5)
  |     --> Skip password import
  |
  +-- OIDC or SAML (enterprise)
  |     --> Reconfigure identity providers (Step 7)
  |     --> Optionally import passwords as fallback
  |
  +-- Multiple methods
        --> Follow all applicable steps below
```

**Critical:** Firebase users can have MULTIPLE auth methods. A user with both password AND Google sign-in needs BOTH migrations.

## Step 3: Password Hash Import (If Applicable)

### Extract Firebase Password Parameters

Run in Firebase Console:

```bash
# Get project-wide hash parameters
firebase auth:export users.json --format=json

# Extract from console settings (Instructions tab)
# You need: base64_signer_key, base64_salt_separator, rounds, mem_cost
```

### Transform to PHC Format

Firebase uses a non-standard scrypt variant. Convert to PHC format:

```
PHC format:
$scrypt$ln=<rounds>,r=8,p=1$<salt>$<hash>$sk=<base64_signer_key>,ss=<base64_salt_separator>

Parameter mapping:
Firebase                 --> PHC parameter
base64_signer_key        --> sk
base64_salt_separator    --> ss
rounds                   --> ln
mem_cost                 --> (not directly mappable - use Firebase default)
salt (per-user)          --> <salt> (base64)
passwordHash (per-user)  --> <hash> (base64)
```

### Import Pattern

```
For each user with passwordHash in Firebase export:
  workos.users.create({
    email: user.email,
    email_verified: user.emailVerified,
    password: "<PHC_formatted_hash>"
  })
```

**Trap:** Firebase exports use base64. WorkOS expects base64 in PHC string — do NOT decode.

Check fetched docs for exact User API endpoint and required fields.

## Step 4: Social Provider Migration (If Applicable)

### Extract OAuth Credentials from Firebase

Firebase Console → Authentication → Sign-in method → [Provider] → View credentials

You need:

- Client ID
- Client Secret

### Configure in WorkOS

WorkOS Dashboard → Redirects → Add redirect URI for your app
WorkOS Dashboard → Authentication → Social Connections → Add connection

**Trap:** Redirect URI MUST match exactly. Firebase uses `/__/auth/handler` — WorkOS uses your custom callback URL.

Update your app's OAuth callback route to use WorkOS SDK auth handling (see `workos-authkit-base` skill).

## Step 5: Email Link → Magic Auth (If Applicable)

Firebase Email Link is comparable to WorkOS Magic Auth.

**Key difference:**

- Firebase: Sends link that completes auth in same browser
- WorkOS: Sends code that user enters in app

Check fetched docs for Magic Auth setup. Configure in WorkOS Dashboard → Authentication → Magic Auth.

**Migration UX:** Add both methods during transition, then deprecate Firebase after users migrate.

## Step 6: User Migration Execution

### Batch Import Pattern

```
For each Firebase user:
  1. Create WorkOS user (with password if imported)
  2. Set email_verified status from Firebase
  3. Preserve user metadata if needed
  4. Map Firebase UID to WorkOS user ID in your DB
```

**Trap:** WorkOS user IDs differ from Firebase UIDs. Store mapping: `firebase_uid` → `workos_user_id`.

**Rate limits:** Check fetched docs for bulk import API limits. Use batching if importing >1000 users.

## Step 7: Enterprise SSO Reconfiguration (If Applicable)

If Firebase app uses OIDC or SAML providers:

1. Extract provider config from Firebase Console → Authentication → Sign-in method → SAML/OIDC
2. WorkOS Dashboard → SSO → Add connection (same provider)
3. Provide NEW WorkOS callback URL to identity provider admin
4. Test connection before cutover

**Critical:** Identity provider must update THEIR config with new WorkOS callback URL. Coordinate timing.

Check fetched docs for OIDC/SAML connection setup specifics.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check Firebase export completed
test -f users.json && echo "✓ Firebase export exists" || echo "✗ Missing"

# 2. Check WorkOS users created
# (Replace with your test user email)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?email=test@example.com" \
  | grep -q "user_" && echo "✓ Users imported" || echo "✗ Import failed"

# 3. Check OAuth redirect configured
grep -r "WORKOS.*REDIRECT" .env* && echo "✓ Redirect set" || echo "✗ Missing redirect URI"

# 4. Check SDK auth integration
grep -r "getAuthorizationUrl\|authkit" src/ && echo "✓ Auth implemented" || echo "✗ No WorkOS auth found"
```

**Do not mark complete until all pass.**

## Error Recovery

### "Invalid password hash format"

**Cause:** PHC formatting incorrect or missing Firebase-specific parameters.

**Fix:**

1. Verify base64 encoding preserved (do NOT decode bytes)
2. Check `sk=` and `ss=` parameters present in hash string
3. Validate parameter order: `$scrypt$ln=...,r=8,p=1$<salt>$<hash>$sk=...,ss=...`

### "User already exists" during import

**Cause:** Email collision or duplicate import attempt.

**Fix:**

1. Check if email already in WorkOS: `workos.users.list({ email: "..." })`
2. If exists, UPDATE user with `workos.users.update()` instead of CREATE
3. Use idempotency: store `firebase_uid → workos_user_id` mapping before import, skip if mapped

### OAuth callback fails after migration

**Cause:** Redirect URI mismatch between Firebase and WorkOS config.

**Fix:**

1. Compare Firebase authorized domains vs WorkOS redirect URIs
2. WorkOS requires FULL callback URL (not just domain)
3. Update OAuth provider (Google Console, etc.) with NEW WorkOS callback
4. Firebase used `/__/auth/handler` — WorkOS uses YOUR custom route

### SAML connection breaks after migration

**Cause:** Identity provider still pointing to Firebase URLs.

**Fix:**

1. Extract NEW WorkOS ACS URL from WorkOS Dashboard → connection details
2. Contact identity provider admin to update SAML config
3. Test connection in WorkOS Dashboard before directing users
4. Keep Firebase connection active during transition (dual config period)

## Related Skills

- `workos-authkit-base` - Core authentication integration (required for auth flow)
- `workos-authkit-nextjs` - Next.js-specific patterns
- `workos-authkit-react` - React client integration
