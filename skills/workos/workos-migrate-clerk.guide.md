<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The migration guide is the source of truth. If this skill conflicts with the guide, follow the guide.

## Step 2: Pre-Migration Assessment

### Data Inventory

Determine what needs migration:

```
Do you have Clerk users?
  |
  +-- Yes, password auth --> Export passwords via Clerk API (Step 3a)
  |
  +-- Yes, social auth only --> Skip to Step 4 (no password export needed)
  |
  +-- No users yet --> Skip to Step 5 (organizations only)
```

```
Do you have Clerk organizations?
  |
  +-- Yes --> Export org data + memberships (Step 5)
  |
  +-- No --> Migration complete after user import
```

```
Do users have SMS-based MFA enrolled?
  |
  +-- Yes --> Plan re-enrollment (Step 6 - WorkOS doesn't support SMS)
  |
  +-- No --> MFA migration not needed
```

### WorkOS Prerequisites

Check `.env` or environment config for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Run `curl -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/user_management/users?limit=1` to confirm API access.

## Step 3: Export User Data from Clerk

### Decision Tree: Export Method

```
Password users exist?
  |
  +-- Yes --> Use Clerk Backend API (Step 3a)
  |
  +-- No --> Use Clerk export or API for basic user data (Step 3b)
```

### Step 3a: Export Passwords (If Needed)

**CRITICAL:** Clerk does NOT expose plaintext passwords. You must use their backend API to get bcrypt hashes.

WebFetch: Clerk's backend API docs for user export with password digests
URL: Check fetched WorkOS docs for Clerk API reference link

Export format must include:
- `password_digest` field (bcrypt hash)
- User email addresses
- First/last names

### Step 3b: Export Basic User Data

Use Clerk Backend SDK to paginate users. Required fields:

- `email_addresses` (pipe-separated if multiple)
- `first_name`
- `last_name`
- Social auth provider linkages (if applicable)

**Trap:** Multiple emails are pipe-separated in Clerk exports (`john@example.com|john.doe@example.com`). You must determine primary email separately via Clerk User API.

## Step 4: Import Users into WorkOS

### Decision Tree: Import Method

```
How many users?
  |
  +-- < 10,000 --> Use WorkOS migration tool (Step 4a)
  |
  +-- > 10,000 or custom logic needed --> Write custom import (Step 4b)
```

### Step 4a: Using WorkOS Migration Tool

Clone: `https://github.com/workos/migrate-clerk-users`

Follow repository README for:
- CSV format requirements
- Rate limit handling
- Dry-run mode

### Step 4b: Custom Import via WorkOS API

**Rate limit:** User creation is rate-limited. Check fetched docs for current limits and batch size recommendations.

**Field mapping:**

```
Clerk field          --> WorkOS API parameter
email_addresses      --> email (single primary email)
first_name           --> first_name
last_name            --> last_name
password_digest      --> password_hash (if passwords exported)
```

**Pseudocode pattern:**

```
for each clerk_user in export:
  primary_email = extract_primary_email(clerk_user.email_addresses)
  
  payload = {
    email: primary_email,
    first_name: clerk_user.first_name,
    last_name: clerk_user.last_name
  }
  
  if clerk_user.password_digest:
    payload.password_hash = clerk_user.password_digest
    payload.password_hash_type = 'bcrypt'
  
  POST /user_management/users with payload
  
  handle_rate_limit_response()
```

**CRITICAL:** When importing passwords:
- Set `password_hash_type` to `'bcrypt'`
- Set `password_hash` to the `password_digest` field from Clerk export
- Do NOT send plaintext passwords

### Handling Multiple Email Addresses

Clerk export format: `"email_addresses": "john@example.com|john.doe@example.com"`

**Decision:** You must choose primary email. Options:

1. **Fetch from Clerk API:** Call Clerk User API to get primary email designation
2. **Use first email:** Split on pipe, take first entry
3. **Manual review:** For VIP users, confirm primary email before import

**Pattern for API fetch:**

```
if '|' in clerk_user.email_addresses:
  user_obj = clerk_api.get_user(clerk_user.id)
  primary_email = user_obj.primary_email_address
else:
  primary_email = clerk_user.email_addresses
```

## Step 5: Migrate Organizations and Memberships

### Export Clerk Organizations

Use Clerk Backend SDK to paginate organizations:

```
GET /organizations endpoint (check Clerk docs for exact path)
  
for each org:
  - Store org ID mapping (Clerk ID -> WorkOS ID for later membership import)
  - Store org name and domain
```

### Create WorkOS Organizations

**Pseudocode pattern:**

```
for each clerk_org in export:
  payload = {
    name: clerk_org.name,
    # Add domain if available in Clerk export
  }
  
  response = POST /organizations with payload
  
  org_id_mapping[clerk_org.id] = response.id
```

### Import Organization Memberships

**CRITICAL:** Complete user import (Step 4) BEFORE importing memberships.

Use Clerk Backend SDK to fetch memberships per organization, then:

```
for each clerk_membership in clerk_org.memberships:
  workos_org_id = org_id_mapping[clerk_membership.organization_id]
  workos_user_id = find_workos_user_by_email(clerk_membership.user_email)
  
  POST /user_management/organization_memberships with:
    organization_id: workos_org_id
    user_id: workos_user_id
```

Check fetched docs for role mapping if Clerk roles need translation.

## Step 6: Handle Social Auth Users

**No password import needed for social auth users.** They will auto-link on first sign-in.

### Configure Social Providers in WorkOS

For each provider used in Clerk (Google, Microsoft, etc.):

1. Navigate to WorkOS Dashboard → Authentication → Social Providers
2. Configure OAuth client credentials for each provider
3. Check fetched docs for provider-specific setup (see WorkOS integrations page)

### Auto-Linking Behavior

WorkOS matches users by email address. When a user signs in via social provider:

```
Social auth sign-in occurs
  |
  +-- Email exists in WorkOS --> Auto-link to existing user
  |
  +-- Email doesn't exist --> Create new user (if allowed by config)
```

**Verification:** After provider config, test sign-in with a migrated user's social account.

## Step 7: MFA Re-Enrollment Plan

**CRITICAL DIFFERENCE:** WorkOS does NOT support SMS-based MFA due to security concerns.

### Impact Assessment

```
Clerk users with SMS MFA?
  |
  +-- Yes --> Users MUST re-enroll with TOTP or email-based Magic Auth
  |
  +-- No --> No action needed
```

### Communication Plan

Draft user communication:
- Explain SMS MFA deprecation
- Provide TOTP enrollment instructions (link to WorkOS MFA guide)
- Offer Magic Auth as alternative

Check fetched docs for MFA enrollment flow details.

## Verification Checklist (ALL MUST PASS)

Run these commands after each migration phase:

```bash
# 1. Verify WorkOS API access
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/users?limit=1 \
  | jq '.data | length'
# Expected: 1 (or total user count if imported)

# 2. Verify user import count matches export
echo "Clerk export rows: $(wc -l < clerk_users.csv)"
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/users?limit=1" \
  | jq '.list_metadata.after'
# Expected: Counts match within margin of error

# 3. Verify password hash import (sample check)
# Attempt sign-in with known password - should succeed

# 4. Verify organization count
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/organizations?limit=1 \
  | jq '.list_metadata.after'
# Expected: Matches Clerk org count

# 5. Verify organization memberships (sample check)
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/user_management/organization_memberships?organization_id=ORG_ID" \
  | jq '.data | length'
# Expected: Matches Clerk membership count for sample org
```

## Error Recovery

### "Rate limit exceeded" during user import

**Root cause:** Importing too fast without respecting rate limits.

**Fix:**
1. Check fetched docs for current rate limit (users per second/minute)
2. Add delay between batches: `sleep 1` between every N users
3. Implement exponential backoff for 429 responses
4. Use WorkOS migration tool (Step 4a) which handles rate limits automatically

### "Email already exists" during user import

**Root cause:** Duplicate emails in Clerk export or partial retry.

**Fix:**
1. Deduplicate export file before import
2. Use upsert pattern: Check if user exists before creating
3. Keep import log to skip already-imported users on retry

### "Invalid password_hash format"

**Root cause:** Password hash not in bcrypt format or missing `password_hash_type` parameter.

**Fix:**
1. Verify Clerk export used Backend API (not basic export)
2. Confirm `password_digest` field exists in export
3. Set `password_hash_type: 'bcrypt'` in API call
4. Check fetched docs for exact parameter names (may vary by SDK version)

### Social auth user can't sign in after migration

**Root cause:** Provider not configured in WorkOS or email mismatch.

**Fix:**
1. Verify provider OAuth credentials in WorkOS Dashboard
2. Check redirect URIs match application URLs
3. Confirm user's social auth email matches imported WorkOS email
4. Test provider sign-in with non-migrated account first (isolation test)

### Organization membership import fails with "User not found"

**Root cause:** User import incomplete or email mismatch.

**Fix:**
1. Confirm ALL users imported before starting membership import (run verification #2)
2. Query WorkOS API for user by email before creating membership
3. Check for email case sensitivity issues (normalize to lowercase)
4. Log failed memberships for manual review

### MFA users locked out after migration

**Root cause:** SMS MFA no longer supported, users not re-enrolled.

**Fix:**
1. Disable MFA requirement temporarily during migration window
2. Send re-enrollment instructions to affected users
3. Provide admin override to reset MFA for support cases
4. Check fetched docs for MFA bypass procedures

## Related Skills

After migration, implement authentication:

- **workos-authkit-nextjs** - If using Next.js App Router
- **workos-authkit-react** - If using React SPA
- **workos-authkit-vanilla-js** - For framework-agnostic implementations
