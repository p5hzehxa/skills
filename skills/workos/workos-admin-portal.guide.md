<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The documentation is the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Account

- Confirm you have WorkOS dashboard access
- Confirm API key exists (starts with `sk_`)
- Confirm client ID exists (starts with `client_`)

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### SDK Installation

- Verify WorkOS SDK is installed before proceeding
- Check: SDK package exists in dependencies

## Step 3: Workflow Selection (Decision Tree)

```
How will IT admins access Admin Portal?
  |
  +-- Dashboard-generated link (email/Slack/DM)
  |     |
  |     +-- Skip to Step 4 (dashboard workflow)
  |     +-- No SDK integration needed
  |
  +-- In-app redirect (seamless integration)
        |
        +-- Continue to Step 5 (programmatic workflow)
        +-- Requires SDK and organization management
```

**Critical:** Workflow A (dashboard) and Workflow B (in-app) are mutually exclusive patterns for the SAME feature. Choose based on your UX requirements.

## Step 4: Dashboard Workflow (Manual Links)

**Use this workflow when:** You want to send IT admins a link via email/Slack without building in-app UI.

### Create Organization in Dashboard

1. Sign in to WorkOS dashboard
2. Navigate to Organizations
3. Click "Create organization"
4. Store organization ID for future reference

### Generate Setup Link

1. Click "Invite admin" button
2. Select features to enable (SSO, Directory Sync, Domain Verification, etc.)
3. Either:
   - Enter IT admin email to auto-send link, OR
   - Copy link to share manually

**Important:** Only one link can be active at a time. Revoke existing link before creating new one via "Manage" button.

**Link expiration:** Links expire 5 minutes after creation. Do NOT email links - redirect immediately or use dashboard auto-send.

**End of dashboard workflow.** Skip to Step 7 for redirect URI configuration.

## Step 5: In-App Workflow (Programmatic Integration)

**Use this workflow when:** You want seamless in-app Admin Portal access without manual link sharing.

### Organization Management Pattern

```
Customer lifecycle          --> Organization action
  |
  +-- New customer signup   --> Create organization immediately
  |                             Store org_id in your database
  |
  +-- IT admin needs setup  --> Generate portal link with org_id
  |                             Redirect immediately (5min expiry)
  |
  +-- Connection exists     --> Generate link with intent for updates
                                (e.g., certificate renewal)
```

### Create Organization (Per Customer)

Use SDK method for creating organizations. Required fields:
- `name` - customer/company name
- `domains` (optional but recommended for domain verification)

**Store the returned `org_id`** - you'll need it for every portal link generation.

**When to create:** During customer onboarding, before they need Admin Portal access.

### Generate Portal Link (On-Demand)

**Timing:** Generate link immediately before redirect - do NOT generate ahead of time (5min expiry).

**Required parameters:**
- `organization` - the org_id from Step 5 creation
- `intent` - one of: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`

**Optional parameters:**
- `return_url` - where to send user after completion (overrides dashboard default)

**Security:** The endpoint that calls this SDK method MUST be auth-protected and restricted to IT admin roles.

Check fetched docs for exact SDK method signature for your language.

## Step 6: Intent Selection (Decision Tree)

```
What is IT admin configuring?
  |
  +-- SSO connection              --> intent: 'sso'
  |
  +-- Directory Sync              --> intent: 'dsync'
  |
  +-- Audit log forwarding        --> intent: 'audit_logs'
  |
  +-- Log stream destination      --> intent: 'log_streams'
  |
  +-- Domain ownership proof      --> intent: 'domain_verification'
  |
  +-- Renewing SAML cert          --> intent: 'certificate_renewal'
```

**Multiple intents:** Generate separate links for each feature. Admin Portal sessions are single-intent.

## Step 7: Configure Redirect URIs (REQUIRED)

**Location:** WorkOS Dashboard → Redirects → Admin Portal Redirect Links

### Default Return URI

- Used when no `return_url` parameter provided in link generation
- MUST use HTTPS
- Where IT admin returns after clicking "Return to app" in portal

### Success URIs (Optional but Recommended)

Configure specific success redirects for:
- SSO setup completion
- Directory Sync setup completion
- Log Streams setup completion

**Pattern:** Use different URIs to trigger different post-setup actions in your app (e.g., redirect to SSO settings page vs. directory settings page).

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 2. Verify API key format
echo $WORKOS_API_KEY | grep -E '^sk_' || echo "FAIL: Invalid API key format"

# 3. Check SDK installed (adapt to your package manager)
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# 4. Test organization creation (if using in-app workflow)
# Run your org creation code - should return org_id starting with 'org_'

# 5. Test portal link generation (if using in-app workflow)
# Run your link generation code - should return URL starting with https://
```

**For in-app workflow only:**

```bash
# 6. Verify redirect URIs configured in dashboard
# Manual check: Visit dashboard.workos.com/redirects
# Confirm at least one default return URI exists
```

## Error Recovery

### "Invalid API key" or 401 errors

**Root cause:** Wrong key or key lacks permissions.

Fix:
1. Check: Key starts with `sk_` (not `client_` which is client ID)
2. Check: Using production key for production org or test key for test org
3. Check: Key has Admin Portal permissions in dashboard

### "Organization not found"

**Root cause:** Trying to generate link for non-existent org_id.

Fix:
1. Check: org_id starts with `org_`
2. Check: org_id exists in your database and in WorkOS dashboard
3. Check: Not mixing test/production environments

### Portal link expires immediately

**Root cause:** Generated link but didn't redirect within 5 minutes.

Fix:
1. Generate link in the SAME request handler that performs redirect
2. Never email portal links - they expire too fast
3. Use dashboard "auto-send" workflow if email delivery is required

### "return_url not allowed"

**Root cause:** Redirect URI not configured in dashboard or doesn't use HTTPS.

Fix:
1. Add URI to dashboard Redirects page
2. Ensure URI uses HTTPS (not HTTP)
3. Check for typos between code and dashboard config

### IT admin sees "No connection found"

**Root cause:** Organization has no connection yet (expected on first setup).

This is NOT an error for intent `sso` or `dsync` - portal will guide them through creation.

**Only an error for:** `certificate_renewal` intent when no SSO connection exists. Verify connection exists before generating renewal link.

### SDK method not found

**Root cause:** SDK version mismatch or wrong import.

Fix:
1. Check fetched docs for SDK version compatibility
2. Verify import statement matches SDK package structure
3. Update SDK to latest version if method is new

### Multiple active portal links

**Root cause:** Dashboard workflow limitation - only one link active at a time.

Fix:
1. Revoke existing link via "Manage" button before creating new one
2. OR switch to in-app workflow which generates fresh links on-demand

## Related Skills

For authentication and user management after Admin Portal setup:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-vanilla-js
