<!-- refined:sha256:a091402053a2 -->

# WorkOS Migration: Auth0

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/auth0`

This guide is the source of truth for migration patterns and data mapping. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Flight Validation

### WorkOS Setup

Check WorkOS Dashboard and environment variables:

- WorkOS account exists with active organization
- `WORKOS_API_KEY` present and starts with `sk_`
- `WORKOS_CLIENT_ID` present (for AuthKit integration post-migration)
- WorkOS SDK installed in project

**Verify:**
```bash
# Check env vars configured
grep -E "WORKOS_(API_KEY|CLIENT_ID)" .env.local || echo "FAIL: Missing WorkOS credentials"

# Check SDK installed (language-specific)
npm list @workos-inc/node || echo "Check: SDK installed in your language"
```

### Auth0 Access

Confirm you have:
- Auth0 admin access
- Ability to request bulk exports
- Management API credentials (for organization export)

## Step 3: Export Planning (Decision Tree)

Determine what you need to export from Auth0:

```
What are you migrating?
  |
  +-- Users ONLY
  |     |
  |     +-- Password auth? --> Need password export (contact Auth0 support, 1+ week)
  |     |
  |     +-- Social auth only? --> Just user export (no password needed)
  |
  +-- Users + Organizations
  |     |
  |     +-- Export users (see above)
  |     +-- Export orgs via Management API
  |     +-- Export org memberships (included in bulk user export)
  |
  +-- MFA users?
        |
        +-- SMS-based MFA --> Users MUST re-enroll (WorkOS doesn't support SMS)
        |
        +-- TOTP-based MFA --> Users MUST re-enroll (can't export seeds)
```

**Critical MFA note:** Auth0 MFA enrollment cannot be migrated. All MFA users will need to re-enroll in WorkOS. Plan user communication accordingly.

## Step 4: Export User Data

### Basic User Export (No Passwords)

Use Auth0's [User Import/Export Extension](https://auth0.com/docs/customize/extensions/user-import-export-extension#export-users):

1. Navigate to Auth0 Dashboard → Extensions → User Import/Export
2. Click "Export"
3. Wait for job completion (email notification)
4. Download newline-delimited JSON file

**Output format:** One JSON object per line, each containing user fields.

### Password Export (If Needed)

**Timeline warning:** This takes 1+ weeks. Start this immediately if needed.

1. [Contact Auth0 support](https://auth0.com/docs/troubleshoot/customer-support)
2. Request "user password hash export"
3. Wait for response with second JSON file
4. File contains subset of user data + `passwordHash` field (bcrypt format)

**Auth0 limitation:** Plaintext passwords are NOT available. You get bcrypt hashes only.

### Organization Export (If Needed)

Use Auth0 Management API to paginate organizations:

```bash
# Pseudocode pattern - adapt to your language
GET https://{auth0-domain}/api/v2/organizations
Authorization: Bearer {management-api-token}

# Handle pagination - check response for 'next' link
# Save each org's: id, name, display_name, metadata
```

Check fetched docs for exact Management API endpoint and response schema.

## Step 5: Import Users into WorkOS

### Option A: Use WorkOS Migration Tool (Recommended)

**Tool location:** https://github.com/workos/migrate-auth0-users

Advantages:
- Handles pagination and rate limiting
- Built-in error recovery
- Field mapping pre-configured

Follow the tool's README for setup and execution.

### Option B: Write Custom Import Script

If you need custom logic or can't use the tool, call WorkOS Create User API directly.

**Field mapping from Auth0 export to WorkOS API:**

| Auth0 Export Field | WorkOS API Parameter |
| ------------------ | -------------------- |
| `email`            | `email`              |
| `email_verified`   | `email_verified`     |
| `given_name`       | `first_name`         |
| `family_name`      | `last_name`          |

**Pattern for import loop:**

```
For each line in auth0-export.ndjson:
  Parse JSON object
  Call WorkOS Create User API with mapped fields
  
  If password hash exists:
    Include password_hash_type='bcrypt'
    Include password_hash={Auth0 passwordHash field}
  
  Handle rate limits (429) with exponential backoff
  Log failures for retry
```

Check fetched docs for exact Create User API endpoint and parameters.

**Critical:** Auth0 uses `bcrypt` for password hashing. WorkOS supports this — set `password_hash_type='bcrypt'` when importing passwords.

## Step 6: Import Organizations (If Applicable)

### Creating Organizations in WorkOS

For each Auth0 organization exported in Step 4:

```
Call WorkOS Create Organization API
  - name: {Auth0 org name}
  - domains: {Auth0 org domains, if any}
  
Save mapping: Auth0_org_id → WorkOS_org_id
```

Check fetched docs for Create Organization API parameters.

### Adding Organization Memberships

Use Auth0's bulk user export (which includes org memberships) to determine which users belong to which orgs.

**Pattern:**

```
For each user in export with organization data:
  Lookup WorkOS user_id (by email)
  Lookup WorkOS org_id (using Auth0→WorkOS mapping from above)
  
  Call WorkOS Create Organization Membership API
    - user_id: {WorkOS user_id}
    - organization_id: {WorkOS org_id}
```

Check fetched docs for Organization Membership API parameters.

## Step 7: Configure Social Auth Providers (If Applicable)

If you have users who signed in via Google, Microsoft, GitHub, etc. through Auth0:

### Provider Setup

For each social provider used in Auth0:

1. Navigate to WorkOS Dashboard → Integrations
2. Find the provider (Google, Microsoft, GitHub, etc.)
3. Configure OAuth client credentials

See [WorkOS integrations page](https://workos.com/integrations) for provider-specific setup.

### Email Matching Behavior

**How WorkOS links social auth users:**

- User signs in with social provider (e.g., Google)
- WorkOS receives email from provider
- WorkOS matches email to existing user created in Step 5
- User is automatically linked

**Email verification note:**

- Some users may need to verify email if WorkOS authentication settings require it
- Behavior varies by provider — `gmail.com` via Google OAuth is pre-verified
- Other domains may require verification step

Check fetched docs for current email verification behavior by provider.

## Step 8: MFA Migration Strategy

**Critical limitation:** Auth0 MFA enrollments CANNOT be migrated.

### Decision Tree

```
Auth0 MFA type?
  |
  +-- SMS-based
  |     |
  |     +-- WorkOS does NOT support SMS (security reasons)
  |     +-- Users MUST switch to:
  |           - Email-based Magic Auth, OR
  |           - TOTP authenticator app
  |
  +-- TOTP-based (Authenticator app)
        |
        +-- Seeds cannot be exported from Auth0
        +-- Users MUST re-enroll with fresh TOTP setup
```

### User Communication Plan

**Before migration:**
1. Email all MFA users explaining they will need to re-enroll
2. Provide timeline and instructions
3. Offer support channel for questions

**After migration:**
1. Prompt users to set up MFA on first login
2. Provide in-app guide for TOTP enrollment
3. Monitor support tickets for MFA issues

## Step 9: Post-Migration Integration

With users imported, integrate WorkOS AuthKit into your application.

**If migrating FROM Auth0 SDK:**

This is a separate integration task. See related skills for your framework:

- Next.js → `workos-authkit-nextjs`
- React → `workos-authkit-react`
- React Router → `workos-authkit-react-router`

**Integration steps:**
1. Replace Auth0 SDK imports with WorkOS SDK
2. Update auth configuration (client ID, redirect URIs)
3. Replace Auth0 session management with WorkOS patterns
4. Update protected route logic
5. Test login/logout flows

Check AuthKit quick start in fetched docs for framework-specific patterns.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm migration completed successfully:

```bash
# 1. Check user import completed
# (Substitute with actual WorkOS API call to list users)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/users | jq '.data | length'
# Should match or be close to Auth0 user count

# 2. If orgs imported, verify count
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations | jq '.data | length'

# 3. Check AuthKit integration (if completed)
npm run build || echo "FAIL: Application build failed"

# 4. Test authentication flow
# - Navigate to login page
# - Sign in with migrated user credentials
# - Verify session created
# - Verify user data accessible
```

## Error Recovery

### "User already exists" during import

**Cause:** Duplicate email in WorkOS or retry of same user.

**Fix:**
1. Check if user already imported successfully (query by email)
2. If complete, skip to next user
3. If partial, use Update User API instead of Create
4. Keep retry log to avoid re-processing

### "Invalid password hash" during import

**Cause:** Password hash format doesn't match bcrypt or is corrupted.

**Fix:**
1. Verify `password_hash_type='bcrypt'` is set correctly
2. Verify hash string is complete (bcrypt hashes are 60 chars)
3. Check Auth0 export file for truncation
4. If hash is invalid, import user WITHOUT password — they'll use password reset flow

### Rate limit (429) during bulk import

**Cause:** Importing too fast.

**Fix:**
1. Implement exponential backoff (double delay each retry)
2. Batch requests with delays between batches
3. Use migration tool (handles this automatically)
4. Contact WorkOS support for rate limit increase if needed

### Social auth users can't sign in post-migration

**Cause:** Provider not configured in WorkOS or email mismatch.

**Fix:**
1. Verify provider OAuth credentials configured in WorkOS Dashboard
2. Check provider callback URL matches WorkOS settings
3. Verify user's email in WorkOS matches provider email exactly
4. Check email verification settings (may need verification step)

### Organization memberships missing

**Cause:** Membership import failed or Auth0 export didn't include org data.

**Fix:**
1. Re-run Auth0 bulk export with organization fields enabled
2. Verify Auth0 org_id → WorkOS org_id mapping is correct
3. Check Organization Membership API calls for errors
4. Manually add memberships for failed users

### MFA users locked out post-migration

**Cause:** MFA enrollments don't transfer — users must re-enroll.

**Expected behavior:** This is not a bug. Provide clear instructions for MFA re-enrollment.

**Fix:**
1. Send password reset email to affected users
2. Walk them through MFA re-enrollment on first login
3. Offer support chat/call for users who need help
4. Consider temporary MFA grace period if WorkOS supports it (check docs)

## Related Skills

- workos-authkit-nextjs — Integrate AuthKit with Next.js post-migration
- workos-authkit-react — Integrate AuthKit with React post-migration
- workos-authkit-react-router — Integrate AuthKit with React Router post-migration
