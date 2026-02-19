<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/firebase`

The migration docs are the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Migration Scope Assessment (Decision Tree)

Identify which Firebase Auth features you're using:

```
Current Firebase Auth methods?
  |
  +-- Email/Password --> Section 3: Password Hash Migration
  |
  +-- Social Auth (Google/Microsoft/etc.) --> Section 4: Social Provider Migration
  |
  +-- Email Link (Passwordless) --> Section 5: Magic Auth Setup
  |
  +-- OIDC/SAML Enterprise --> Section 6: Enterprise Connection Migration
  |
  +-- Multiple methods --> Follow ALL applicable sections
```

**Common trap:** Firebase allows multiple auth methods per user. You may need to migrate BOTH password hashes AND social connections for the same user base.

## Step 3: Password Hash Migration

### Firebase Scrypt Parameters Export

Firebase uses a custom scrypt variant. You MUST export project-level hash parameters from the Firebase Console:

1. Navigate to Firebase Console → Authentication → Users
2. Export password hash parameters (see fetched docs for exact UI location)
3. Required parameters: `base64_signer_key`, `base64_salt_separator`, `rounds`, `mem_cost`

**Verification command:**

```bash
# Check parameters are base64-encoded strings
echo "$base64_signer_key" | base64 -d >/dev/null 2>&1 && echo "PASS: signer_key" || echo "FAIL: signer_key not base64"
```

### User-Level Hash Export

Export individual user password hashes via Firebase CLI:

```bash
firebase auth:export users.json --format=json
```

**Critical fields per user:**
- `passwordHash` - exists only if user has password set
- `salt` - user-specific salt value

**Common trap:** Not all Firebase users have passwords. Users who only use social auth will lack `passwordHash` field — this is expected, not an error.

### PHC Hash Format Conversion

WorkOS requires PHC-compatible hash strings. Transform Firebase parameters:

```
PHC format:
$firebase-scrypt$sk={base64_signer_key}$ss={base64_salt_separator}$r={rounds}$m={mem_cost}$p={salt}${passwordHash}
```

**Parameter mapping:**
- `base64_signer_key` → `sk`
- `base64_salt_separator` → `ss`
- `rounds` → `r`
- `mem_cost` → `m`
- User's `salt` → `p`
- User's `passwordHash` → final component after `$`

Check fetched docs for exact PHC string syntax — dollar signs and equals signs are significant.

### Import to WorkOS

Use WorkOS User Creation API with password hash:

- Create user with PHC-formatted hash during initial creation, OR
- Update existing WorkOS user with password hash via Update User API

Check fetched docs for exact API endpoint and request schema.

**Verification command:**

```bash
# Test a sample PHC hash string parses correctly
echo "$phc_hash" | grep -E '^\$firebase-scrypt\$sk=' && echo "PASS: PHC format" || echo "FAIL: Invalid PHC format"
```

## Section 4: Social Provider Migration

### Provider Credential Transfer

Firebase social auth uses OAuth client credentials. **You provide the SAME credentials to WorkOS** — no provider-side reconfiguration needed.

**Decision tree for provider support:**

```
Firebase provider?
  |
  +-- Google --> WorkOS supports (check docs for setup)
  |
  +-- Microsoft --> WorkOS supports (check docs for setup)
  |
  +-- GitHub --> Check fetched docs for current support
  |
  +-- Apple --> Check fetched docs for current support
  |
  +-- Other --> Contact support@workos.com for availability
```

### Configuration Steps

For each social provider:

1. Retrieve Client ID and Client Secret from Firebase Console
2. Configure matching provider connection in WorkOS Dashboard
3. Use SAME credentials — do not generate new OAuth apps

**Critical:** If you generate NEW OAuth credentials, users will see unexpected consent screens. Reuse Firebase's credentials to preserve UX.

Check fetched docs for provider-specific integration guides (e.g., `/integrations/google-oauth`).

**Verification:**

Test auth flow before production cutover:
- User should NOT see consent screen if previously consented in Firebase
- User profile data should match Firebase records

## Section 5: Magic Auth Setup (Email Link Replacement)

Firebase Email Link → WorkOS Magic Auth mapping:

| Firebase Feature | WorkOS Equivalent |
|------------------|-------------------|
| Email Link sign-in | Magic Auth |
| Custom email templates | Check fetched docs for template customization |
| Link expiration | Check fetched docs for TTL configuration |

Magic Auth setup:
1. Enable Magic Auth in WorkOS Dashboard
2. Configure email sender domain
3. Update application to trigger Magic Auth flow instead of Firebase Email Link

Check fetched docs for Magic Auth API reference and exact endpoint usage.

**Common trap:** Magic Auth links are ONE-TIME use. If users bookmark Firebase email links, they'll break after migration. Consider a grace period with both systems active.

## Section 6: Enterprise Connection Migration (OIDC/SAML)

### Protocol Preservation

Firebase OIDC/SAML connections can be replicated in WorkOS with SAME IdP configuration:

```
Connection type?
  |
  +-- OIDC --> WorkOS OIDC connection setup
  |
  +-- SAML --> WorkOS SAML connection setup
```

### Migration Steps Per Connection

1. Export connection details from Firebase Console:
   - OIDC: Client ID, Client Secret, Issuer URL, JWKS endpoint
   - SAML: IdP Entity ID, SSO URL, X.509 certificate

2. Create matching connection in WorkOS Dashboard

3. **Critical:** Update IdP redirect URIs to WorkOS callback URLs BEFORE cutover

**Verification (OIDC):**

```bash
# Check OIDC discovery endpoint is accessible from WorkOS
curl -f "https://{issuer}/.well-known/openid-configuration" && echo "PASS: Discovery works" || echo "FAIL: Discovery unreachable"
```

**Verification (SAML):**

Test assertion signing with WorkOS ACS URL — check fetched docs for test connection flow.

Check fetched docs for detailed OIDC and SAML setup guides (`/integrations/oidc`, `/integrations/saml`).

## Section 7: Migration Cutover Checklist

Run these verifications BEFORE switching production traffic:

```bash
# 1. WorkOS API key is valid
curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/user_management/users?limit=1 && echo "PASS: API key" || echo "FAIL: API key invalid"

# 2. Callback URLs match across systems
grep -r "WORKOS_REDIRECT_URI" .env* && echo "PASS: Redirect URI configured" || echo "FAIL: Missing redirect URI"

# 3. Test user can authenticate via each migrated method
echo "MANUAL TEST: Authenticate with each method (password, social, magic, enterprise)"
```

**Critical:** Do NOT delete Firebase Auth configuration until AFTER verifying WorkOS handles 100% of auth traffic for 7+ days.

## Error Recovery

### "Invalid PHC hash format"

**Root cause:** Incorrect parameter mapping or missing dollar signs.

**Fix:**
1. Verify all parameters are base64-encoded
2. Check PHC string matches pattern: `$firebase-scrypt$sk=...$ss=...$r=...$m=...$p=...$<hash>`
3. No spaces, no line breaks in final string

### "Social auth requires re-consent"

**Root cause:** Used NEW OAuth credentials instead of Firebase's credentials.

**Fix:**
1. Delete new OAuth app in provider console
2. Retrieve ORIGINAL credentials from Firebase Console
3. Update WorkOS connection with original credentials

### "SAML assertion signature verification failed"

**Root cause:** IdP still sending assertions to Firebase callback URL.

**Fix:**
1. Update IdP ACS URL to WorkOS callback
2. Re-export IdP metadata to WorkOS Dashboard
3. Test connection before production cutover

### "Magic Auth emails not delivering"

**Root cause:** Email sender domain not verified in WorkOS.

**Fix:**
1. Check WorkOS Dashboard for domain verification status
2. Add required DNS records (SPF, DKIM)
3. Wait for DNS propagation (up to 48 hours)

### Unsupported Provider Error

**Root cause:** Firebase provider not yet supported by WorkOS.

**Fix:**
- Check fetched docs for current provider list
- Contact support@workos.com with provider name and usage volume
- Consider parallel auth system during transition period

## Related Skills

- workos-authkit-nextjs - For integrating AuthKit after migration
- workos-authkit-react - For React-based Firebase apps
