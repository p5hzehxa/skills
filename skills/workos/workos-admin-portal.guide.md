<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these env vars:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Do not proceed without both.**

### WorkOS SDK

Verify SDK is installed:

```bash
# Check package manager lockfile for workos package
ls package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null | xargs grep -l "workos" || echo "SDK not installed"
```

If not found, install SDK first — see fetched docs for installation command.

## Step 3: Workflow Decision Tree

Admin Portal has two distinct workflows. Choose based on your integration needs:

```
How will IT admins access the portal?
  |
  +-- Shareable link (email/Slack/SMS)
  |     |
  |     +-- Go to WorkOS Dashboard
  |     +-- Create organization (if not exists)
  |     +-- Click "Invite admin" → Copy setup link
  |     +-- Share link directly
  |     +-- SKIP Steps 4-7 (no code integration needed)
  |
  +-- In-app redirect (seamless UX)
        |
        +-- CONTINUE to Step 4 (SDK integration required)
```

**Link expiration trap:** Portal links expire 5 minutes after creation. Do NOT email generated links — redirect immediately. For email workflows, use Dashboard-generated links instead.

## Step 4: Dashboard Configuration (In-App Integration Only)

Navigate to WorkOS Dashboard → Redirects tab.

### Required: Default Return URI

Set where users land when clicking "Back to [YourApp]" in the portal.

**Must use HTTPS** — localhost allowed for development only.

### Optional: Success URIs

Set specific redirects after completing each feature:

- SSO setup complete → Custom success page
- Directory Sync complete → Custom success page
- Log Streams complete → Custom success page

**Decision:** If NOT set, users return to Default Return URI after any action.

## Step 5: Organization ID Mapping (CRITICAL)

Each customer that needs Admin Portal access MUST have a WorkOS organization.

**Timing decision tree:**

```
When to create WorkOS organization?
  |
  +-- New customer signup
  |     → Create org immediately, store org_id in customer record
  |
  +-- Existing customer enables SSO
  |     → Create org on-demand when they click "Configure SSO"
  |
  +-- Migration from another auth provider
        → Create org during migration, map old provider ID → WorkOS org_id
```

**Storage requirement:** Your database MUST maintain `workos_org_id` for each customer. Portal links require this ID.

Check fetched docs for SDK method to create organizations — it returns an org ID to store.

## Step 6: Generate Portal Link

**Security model:** Portal links are single-use, expire in 5 minutes, scoped to one organization.

### Intent Parameter (Required)

Specify what the IT admin can configure:

- `sso` - SSO connection setup
- `dsync` - Directory Sync setup
- `audit_logs` - Audit log configuration
- `log_streams` - Log streaming setup
- `domain_verification` - Domain ownership verification
- `certificate_renewal` - SAML certificate renewal

**Multi-intent trap:** One link = one intent. To enable multiple features, generate separate links or use a settings dashboard with multiple buttons.

### Implementation Pattern

```
workos.portal.generateLink({
  organization: org_id_from_database,
  intent: "sso",
  return_url: "https://yourapp.com/settings/sso/complete"  // Optional
})
→ Returns: { link: "https://id.workos.com/portal/launch?token=..." }
→ Redirect user immediately to link
```

**return_url override:** If provided, overrides Dashboard default. Useful for feature-specific success pages.

Check fetched docs for exact SDK method signature in your language.

## Step 7: Route Protection (CRITICAL)

The endpoint that generates portal links MUST be:

1. **Behind authentication** - Verify user is logged in
2. **Admin-only** - Verify user has IT admin role for their org
3. **Org-scoped** - Verify user belongs to the org they're configuring

**Security trap:** Do NOT expose portal link generation to regular users. IT admins only.

Example protection pattern:

```
Route: POST /api/admin/portal/sso
  |
  +-- Check: User authenticated?
  +-- Check: User role includes "IT_ADMIN"?
  +-- Check: User.org_id matches requested org_id?
  +-- Generate portal link for User.org_id
  +-- Return redirect to portal link
```

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Env vars exist
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" || echo "FAIL: Missing env vars"

# 2. Dashboard redirect URI configured (manual check)
# Visit: https://dashboard.workos.com/redirects
# Confirm: At least one redirect URI exists and uses HTTPS

# 3. Organization exists for test customer
# Use WorkOS Dashboard or SDK to verify org creation

# 4. Portal link generates without error
# Test: Call your portal link endpoint with test org_id
# Expected: Receive URL starting with https://id.workos.com/portal/launch

# 5. Link expires after 5 minutes
# Generate link, wait 6 minutes, try to access
# Expected: "Link expired" error page
```

## Error Recovery

### "Invalid API key" / 401 Unauthorized

**Root cause:** API key wrong, expired, or missing.

Fix:

1. Verify `WORKOS_API_KEY` starts with `sk_`
2. Check key is for correct environment (test vs. prod)
3. Regenerate key in Dashboard if needed — update env var immediately

### "Organization not found" / 404

**Root cause:** org_id doesn't exist or typo in stored ID.

Fix:

1. Query WorkOS for organization by external reference: `workos.organizations.list({ domains: ["customer.com"] })`
2. If not found, create organization, update customer record with returned org_id
3. If found, verify stored org_id matches returned ID — fix database if mismatch

### "Redirect URI not configured" / Portal link fails

**Root cause:** Dashboard has no redirect URIs OR provided return_url not allowlisted.

Fix:

1. Visit Dashboard → Redirects tab
2. Add redirect URI using HTTPS (or http://localhost for dev)
3. If using `return_url` parameter, ensure it's a subpath of configured URI

### "Link expired" immediately after generation

**Root cause:** Clock skew between your server and WorkOS, OR delay in redirect.

Fix:

1. Verify server clock is accurate: `date` should match real time
2. Profile link generation → redirect latency. Must be under 60 seconds.
3. If generating link in webhook/background job, store link and redirect immediately when user requests it (bad pattern — generate on-demand instead)

### Portal shows wrong organization name

**Root cause:** Organization `name` field set incorrectly during creation.

Fix:

1. Update organization name: Check fetched docs for SDK update method
2. Organization name should match customer-facing company name, not internal ID

### User stuck in portal after completion

**Root cause:** No return URI configured and no success URI for the intent.

Fix:

1. Set default return URI in Dashboard → Redirects
2. OR provide `return_url` parameter when generating link
3. Verify URL uses HTTPS and is accessible to user

## Related Skills

- workos-authkit-nextjs - For pairing Admin Portal with AuthKit authentication
- workos-authkit-react - For React-based settings pages that launch Admin Portal
