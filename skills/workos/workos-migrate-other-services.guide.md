<!-- refined:sha256:aac9aa69edce -->

# WorkOS Migration: Other Services

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/other-services`

The fetched documentation is the source of truth. If this skill conflicts with it, follow the docs.

## Step 2: Pre-Migration Planning (Decision Tree)

### Password Strategy Decision

```
Can you export password hashes from current system?
  |
  +-- YES --> Which algorithm?
  |             |
  |             +-- bcrypt/scrypt/pbkdf2/argon2/ssha/firebase-scrypt
  |             |     --> Import hashes during user creation
  |             |
  |             +-- Other algorithm
  |                   --> Use password reset flow instead
  |
  +-- NO  --> Use password reset flow (trigger programmatically)
  |
  +-- Don't want passwords --> Skip password handling entirely
                                (e.g., moving to Magic Auth only)
```

**Critical:** WorkOS supports ONLY the algorithms listed. Check fetched docs for exact algorithm names and parameter formats.

### Interim User Strategy Decision

```
Can you disable signups during migration?
  |
  +-- YES --> Schedule migration window, disable signups
  |           Simplest approach, zero data drift
  |
  +-- NO  --> Dual-write strategy required
              |
              +-- New signups write to BOTH systems
              +-- Updates (email, auth method) write to BOTH systems
              +-- Migration imports EXISTING users only (skip duplicates)
```

**Trade-offs:**
- Disable signups: Requires downtime window, but no complexity
- Dual-write: Zero downtime, but requires handling sync drift and duplicate detection

**Which to choose:** Depends on user tolerance for disruption. Smaller apps can disable signups. Critical-path apps need dual-write.

### Social Auth Provider Mapping

List all social providers currently in use. For each provider, check if WorkOS supports it:

1. Visit WorkOS Dashboard → Integrations
2. Find provider (Google, Microsoft, GitHub, etc.)
3. If supported: Configure provider credentials in WorkOS BEFORE migration
4. If NOT supported: Users will need to re-authenticate with a different method

**Critical:** WorkOS matches social auth users by EMAIL ADDRESS. If a user's email differs between your system and their social provider, they will NOT auto-link. Plan for manual resolution.

## Step 3: User Data Export

### Export User Records

From your current system, export:

- User ID (your internal ID)
- Email address
- Email verification status
- Password hash (if migrating passwords)
- Password algorithm details (salt, iterations, etc.)
- Social auth provider IDs (if applicable)

**Trap:** Some systems (e.g., AWS Cognito, Firebase Auth) do NOT allow password hash export. If yours doesn't, you MUST use password reset flow.

### Validate Export Data

Run these checks on exported data BEFORE import:

```bash
# Check for duplicate emails (will cause import failures)
awk -F',' '{print $2}' users.csv | sort | uniq -d

# Check for missing required fields
awk -F',' 'NF < 3' users.csv

# Count total records
wc -l users.csv
```

All checks should return empty (no output) except record count.

## Step 4: User Import to WorkOS

### Import Users Without Passwords

For each user, call Create User API (check fetched docs for exact endpoint):

**Fields to include:**
- `email` (required)
- `email_verified` (boolean, based on current verification status)
- `first_name`, `last_name` (optional, if available)

**Critical:** Save the returned WorkOS `user_id` in your database ALONGSIDE your internal user ID. You'll need both during the transition period.

**Verification command:**
```bash
# After import, check your database for WorkOS IDs
psql -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NULL;"
# Should return 0
```

### Import Users With Passwords

If migrating passwords, include password hash details in Create User call:

**Password field structure** (check fetched docs for exact schema):
- Algorithm name (e.g., `"bcrypt"`)
- Hash value
- Algorithm-specific parameters (salt, iterations, etc.)

**Trap:** Each algorithm has different required parameters. bcrypt needs cost factor, pbkdf2 needs iterations + salt, etc. Check fetched docs for your specific algorithm.

**Verification command:**
```bash
# Test authentication for a sample user
curl -X POST https://api.workos.com/user_management/authenticate \
  -u "$WORKOS_CLIENT_ID:$WORKOS_API_KEY" \
  -d email="test@example.com" \
  -d password="test_password"
# Should return 200 with session token
```

### Trigger Password Resets (Alternative Path)

If NOT importing passwords, trigger password reset for each user:

**When to do this:**
- During import: Add reset trigger to import script
- After import: Batch process all users
- On first login attempt: Lazy trigger (user-initiated)

**Trap:** Users will receive password reset emails. Communicate this clearly BEFORE migration or you'll get support tickets.

## Step 5: Configure Social Auth Providers

For each social provider in use:

1. WorkOS Dashboard → Integrations → [Provider Name]
2. Add OAuth client ID + secret from provider's developer console
3. Configure redirect URIs to point to WorkOS
4. Test: Attempt login with test account for this provider

**Critical:** WorkOS auto-links social auth users by email. This happens AFTER migration when user first signs in with the provider.

**Email verification note:** Check fetched docs for which providers are "known verified" (e.g., Gmail addresses from Google OAuth). Others may require extra verification step.

## Step 6: Dual-Write Implementation (If Required)

If you chose dual-write strategy:

### Add WorkOS User Creation to Signup Flow

```
New user signup
  |
  +-- Create user in existing system (as before)
  |
  +-- Create matching user in WorkOS via Create User API
  |     |
  |     +-- Save returned workos_user_id in database
  |     |
  |     +-- If WorkOS call fails:
  |           |
  |           +-- Log error with full user details
  |           +-- Add to retry queue
  |           +-- DO NOT block signup
```

**Critical:** WorkOS creation should NOT block signup. If it fails, queue for retry.

### Add WorkOS Updates to User Edit Flow

For email changes, password changes, or auth method changes:

1. Update existing system (as before)
2. Update WorkOS via Update User API (check fetched docs for endpoint)
3. If WorkOS update fails: Same logging + retry pattern as signup

**Trap:** Sync drift WILL happen. Build a reconciliation job to compare WorkOS users vs. your database and log discrepancies.

### Import Historical Users

After dual-write is live:

1. Export users created BEFORE dual-write start date
2. Import to WorkOS (same process as Step 4)
3. Handle duplicates: If WorkOS returns "user already exists" error, lookup workos_user_id and update your database

**Verification command:**
```bash
# Check for users without WorkOS IDs (missing from import)
psql -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NULL AND created_at < '$DUAL_WRITE_START_DATE';"
# Should return 0
```

## Step 7: Switch Authentication to WorkOS

### Update Login Flow

Replace current authentication logic with WorkOS AuthKit. Check these related skills:
- workos-authkit-nextjs (for Next.js apps)
- workos-authkit-react (for React SPAs)
- workos-authkit-vanilla-js (for other frameworks)

**During transition period:** Continue accepting BOTH old and new authentication methods. Use presence of `workos_user_id` to determine which path.

### Test Authentication Paths

Test each authentication method:

```bash
# Password login
curl -X POST https://api.workos.com/user_management/authenticate \
  -d email="user@example.com" -d password="password"

# Social auth (requires browser flow - test manually)

# Magic auth (requires email delivery - test with real inbox)
```

**All should return session tokens.** If any fail, check WorkOS Dashboard → Logs for error details.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. All users have WorkOS IDs
psql -c "SELECT COUNT(*) FROM users WHERE workos_user_id IS NULL;" 
# Should return 0

# 2. Social providers configured
curl -u "$WORKOS_CLIENT_ID:$WORKOS_API_KEY" \
  https://api.workos.com/user_management/connections
# Should list expected providers

# 3. Sample authentication works
curl -X POST https://api.workos.com/user_management/authenticate \
  -u "$WORKOS_CLIENT_ID:$WORKOS_API_KEY" \
  -d email="test@example.com" -d password="test_password"
# Should return 200 with session

# 4. WorkOS SDK integrated in app
grep -r "workos" src/ package.json
# Should show SDK imports in code

# 5. Login UI points to WorkOS
grep -r "workos.com\|authkit" src/
# Should show AuthKit integration
```

## Error Recovery

### "User already exists" during import

**Root cause:** Dual-write created user before historical import ran, or re-running import script.

**Fix:**
1. Fetch existing user by email via Get User API (check fetched docs)
2. Extract `workos_user_id` from response
3. Update your database with the WorkOS ID
4. Continue import with next user

**Prevention:** Track import progress. Mark imported users in your database before starting.

### "Invalid password hash" during import with passwords

**Root cause:** Algorithm parameters don't match WorkOS requirements.

**Fix:**
1. Check fetched docs for exact parameter format for your algorithm
2. Common issues:
   - bcrypt: Cost factor must be integer (not string)
   - pbkdf2: Iterations must be provided
   - scrypt: All parameters (N, r, p) required
3. Re-export password data with correct format

**Workaround:** Switch to password reset flow for affected users.

### Social auth user doesn't auto-link

**Root cause:** Email mismatch between your system and social provider, or email not verified by provider.

**Fix:**
1. Check WorkOS Dashboard → Users → Find user by email
2. If user exists with different email: Manual merge required (no API for this)
3. If email verification pending: User must verify email first
4. Check fetched docs for provider-specific email verification behavior

### Dual-write sync drift

**Root cause:** WorkOS API call failed during signup/update, but local creation succeeded.

**Fix:**
1. Build reconciliation script:
   ```bash
   # Pseudo-code pattern
   for each user in local_db where workos_user_id IS NULL:
     try fetch from WorkOS by email
     if exists: update local_db with workos_user_id
     else: create in WorkOS now
   ```
2. Run reconciliation daily until migration complete
3. Monitor logs for recurring failures (may indicate API key issue)

### "Authentication failed" after migration

**Root cause:** User's password hash didn't import correctly, or password reset not triggered.

**Fix:**
1. Check WorkOS Dashboard → Users → Find user → Authentication Methods
2. If password hash missing: Trigger password reset for user
3. If social auth available: Prompt user to sign in with social instead
4. If neither available: Manual password reset required

**Prevention:** Test authentication for sample users BEFORE declaring migration complete.

## Related Skills

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
- workos-authkit-base
