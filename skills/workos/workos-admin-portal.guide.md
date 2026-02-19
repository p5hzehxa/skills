<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal Integration

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Integration Strategy (Decision Tree)

```
How will IT admins access Admin Portal?
  |
  +-- Dashboard links (email/Slack)
  |     |
  |     +-- Skip SDK setup
  |     +-- Go to Step 3 (Dashboard workflow)
  |
  +-- In-app integration (seamless UX)
        |
        +-- Requires SDK
        +-- Go to Step 4 (SDK workflow)
```

**Dashboard workflow:** Generate shareable links from WorkOS dashboard. No SDK required. IT admin clicks link from email/Slack. Use for pilot customers or low-touch setups.

**SDK workflow:** Generate portal links programmatically. Redirect user from your app. Use for product-led growth or white-label UX.

## Step 3: Dashboard Workflow (No SDK Required)

### 3A: Create Organization

WorkOS Dashboard → Organizations → Create new

Provide:
- Name (customer company name)
- Domains (optional, for domain verification)

**Verify:** Organization appears in dashboard list. Copy `org_` prefixed ID.

### 3B: Generate Setup Link

1. Click organization → "Invite admin"
2. Select features: SSO, Directory Sync, Domain Verification, Log Streams
3. Choose delivery:
   - Email IT admin directly (WorkOS sends email), OR
   - Copy link for manual sharing

**Link expiration:** 5 minutes after creation. Do not store for later use.

### 3C: Share Link

If copied manually, include in message:
- What the link does ("Configure SSO for your team")
- How long it's valid ("5 minutes")
- Who to contact for help

**STOP HERE if using dashboard workflow.** Skip to Step 7 (Configure Redirects).

## Step 4: Pre-Flight Validation (SDK Workflow)

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**If missing:** Go to WorkOS Dashboard → API Keys → Copy values

### SDK Installation

Detect package manager (npm, yarn, pnpm, bun). WebFetch SDK docs for install command.

**Verify:** SDK package appears in `node_modules` or equivalent before continuing.

## Step 5: Organization Management (SDK Workflow)

### 5A: When to Create Organizations

```
Customer signup flow:
  |
  +-- Free tier user?
  |     |
  |     +-- No organization needed yet
  |
  +-- Enterprise tier / SSO required?
        |
        +-- Create organization NOW
        +-- Store org_id in customer record
```

**Pattern:** One organization per customer company, NOT per user.

### 5B: Create Organization

Use SDK method for creating organizations. Check fetched docs for exact signature.

Required fields:
- `name` - Customer company name
- `domains` (optional) - Array of verified domains

**Verify:** API returns `org_` prefixed ID. Store this ID in your database alongside customer record.

### 5C: Organization-Customer Mapping

```sql
-- Example schema pattern (adjust to your DB)
ALTER TABLE customers ADD COLUMN workos_organization_id VARCHAR(255);
CREATE INDEX idx_customers_org_id ON customers(workos_organization_id);
```

**Critical:** You MUST maintain this reference. Portal links require organization ID.

## Step 6: Portal Link Generation (SDK Workflow)

### 6A: Intent Selection (Decision Tree)

```
What does IT admin need to configure?
  |
  +-- SSO setup             --> intent: "sso"
  |
  +-- Directory Sync        --> intent: "dsync"
  |
  +-- Domain verification   --> intent: "domain_verification"
  |
  +-- Audit log streaming   --> intent: "log_streams"
  |
  +-- Certificate renewal   --> intent: "certificate_renewal"
  |
  +-- Multiple features     --> intent: "sso" (most common starting point)
```

**Note:** One intent per portal link. For multi-step setup, generate multiple links or start with "sso" (includes domain verification).

### 6B: Generate Portal Link

Use SDK method for generating portal links. Check fetched docs for exact signature.

Required parameters:
- `organization` - The `org_` prefixed ID
- `intent` - One of the intents from 6A

Optional parameters:
- `return_url` - Where user goes after clicking "Back to [App]" button

**Link expiration:** 5 minutes. Generate immediately before redirect.

**Critical:** This endpoint MUST be behind auth. Only IT admins should access it.

### 6C: Redirect Pattern (Pseudocode)

```
GET /settings/sso/configure
  |
  +-- Auth check: Is user an admin for this customer?
  |     |
  |     +-- No --> 403 Forbidden
  |
  +-- Lookup: Get workos_organization_id for customer
  |
  +-- Generate portal link:
  |     - organization: workos_organization_id
  |     - intent: "sso"
  |     - return_url: "https://yourapp.com/settings/sso/complete"
  |
  +-- Redirect: 302 to portal link
```

**Do NOT:**
- Email portal links (they expire in 5 minutes)
- Store portal links for reuse
- Generate links without auth checks

## Step 7: Configure Redirect URIs (REQUIRED)

WorkOS Dashboard → Redirects → Admin Portal Redirect Links

### 7A: Default Return URI

This is where "Back to [App]" button goes if no `return_url` is specified.

Set to your app's main settings page: `https://yourapp.com/settings`

**Must use HTTPS.** HTTP not allowed in production.

### 7B: Success URIs (Optional but Recommended)

Configure different redirect destinations after successful setup:

- **SSO Success URI:** Where to redirect after SSO connection created
- **Directory Sync Success URI:** After directory configured
- **Log Streams Success URI:** After log stream configured

Example pattern:
```
SSO Success:    https://yourapp.com/settings/sso/success
DSync Success:  https://yourapp.com/settings/directory/success
```

**Why optional?** If not set, uses default return URI. Set these to show feature-specific success messages.

### 7C: Verification

Visit redirect URIs in browser:
- Should NOT 404
- Should NOT require re-authentication (user already authed)
- Should show appropriate "setup complete" messaging

## Step 8: Webhook Setup (Optional but Recommended)

Admin Portal triggers events when IT admins complete setup. To react in real-time:

1. Set up webhook endpoint in your app
2. Configure webhook URL in WorkOS Dashboard → Webhooks
3. Handle events:
   - `connection.activated` - SSO connection ready
   - `directory.activated` - Directory Sync ready
   - `domain.verified` - Domain verification complete

**Pattern:** Use events to update customer feature flags, send confirmation emails, trigger onboarding flows.

See related skill: `workos-webhooks` for webhook implementation details.

## Verification Checklist (ALL MUST PASS)

### For Dashboard Workflow:

```bash
# 1. Organization exists
curl -X GET https://api.workos.com/organizations/org_XXXXX \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  | grep '"id"'

# 2. Dashboard redirect URIs configured (manual check)
# Visit: https://dashboard.workos.com/redirects
# Verify: Default return URI is set and uses HTTPS
```

### For SDK Workflow:

```bash
# 1. SDK package installed
npm list | grep workos || echo "SDK not found"

# 2. Environment variables set
env | grep WORKOS_API_KEY || echo "Missing API key"
env | grep WORKOS_CLIENT_ID || echo "Missing client ID"

# 3. Organization creation works (replace with your test script)
node -e "const WorkOS = require('@workos-inc/node').WorkOS; \
  const workos = new WorkOS(process.env.WORKOS_API_KEY); \
  workos.organizations.createOrganization({name: 'Test Org'}) \
    .then(() => console.log('✓ Org creation works')) \
    .catch(e => console.error('✗ Org creation failed:', e.message))"

# 4. Portal link generation works (replace org_id)
node -e "const WorkOS = require('@workos-inc/node').WorkOS; \
  const workos = new WorkOS(process.env.WORKOS_API_KEY); \
  workos.portal.generateLink({organization: 'org_XXXXX', intent: 'sso'}) \
    .then(link => console.log('✓ Portal link:', link)) \
    .catch(e => console.error('✗ Link generation failed:', e.message))"

# 5. Redirect endpoint is auth-protected (should return 401/403 without auth)
curl -I https://yourapp.com/settings/sso/configure | grep -E "401|403"
```

## Error Recovery

### "Invalid API key" when generating portal links

**Root cause:** API key incorrect, expired, or environment variable not loaded.

**Fix:**
1. Verify key starts with `sk_` (NOT `client_`)
2. Check key in WorkOS Dashboard → API Keys matches your env var
3. Restart app to reload environment variables
4. Test key directly:
   ```bash
   curl -H "Authorization: Bearer $WORKOS_API_KEY" \
     https://api.workos.com/organizations | jq
   ```

### "Organization not found" error

**Root cause:** `org_` ID typo, or organization was deleted, or using test ID in production.

**Fix:**
1. Verify organization exists in dashboard
2. Check ID matches exactly (case-sensitive)
3. Ensure using correct environment (test vs production keys)
4. Confirm customer-organization mapping in your database

### Portal link expired

**Root cause:** Link generated more than 5 minutes ago.

**Fix:**
1. Generate link immediately before redirect (NOT during page load)
2. Pattern:
   ```
   User clicks "Configure SSO" button
     → Generate link (server-side)
     → Immediate 302 redirect
   ```
3. Do NOT:
   - Generate link on page load and store in hidden form field
   - Email links to users
   - Cache links for reuse

### Redirect URI not allowed

**Root cause:** Return URL not configured in WorkOS Dashboard → Redirects.

**Fix:**
1. Add the exact URL to allowed list in dashboard
2. Ensure using HTTPS in production
3. Match scheme/host/path exactly (trailing slash matters)
4. Example: `https://app.example.com/settings` ≠ `https://app.example.com/settings/`

### User stuck in Admin Portal (no "Back" button)

**Root cause:** No return URL configured (neither default nor per-link).

**Fix:**
1. Set default return URI in dashboard: WorkOS Dashboard → Redirects
2. OR provide `return_url` parameter when generating portal link
3. Verify redirect URI actually exists in your app (not 404)

### IT admin sees "No organization" error

**Root cause:** Portal link generated with invalid or deleted organization ID.

**Fix:**
1. Check organization exists before generating link:
   ```
   GET /organizations/{org_id} → returns 200 = org exists
   ```
2. Handle deleted organizations gracefully in your app
3. Show error message: "Contact support to re-enable SSO setup"

### Connection not appearing in app after setup

**Root cause:** Not listening for `connection.activated` webhook, or webhook endpoint failing.

**Fix:**
1. Set up webhook endpoint to receive WorkOS events
2. Test webhook delivery: WorkOS Dashboard → Webhooks → Send test event
3. Return 200 status from webhook endpoint
4. Parse event payload for `connection.id` and store in your database
5. Fallback: Poll WorkOS API for connections if webhook delivery is unreliable

## Advanced Patterns

### Multi-Organization Users

If a single user belongs to multiple customer organizations (e.g., agencies, consultants):

```
User auth → Select organization context
  |
  +-- For each organization:
        |
        +-- Generate separate portal link with that org's ID
        +-- User can only manage SSO for currently-selected org
```

**Do NOT:** Mix organization IDs in a single portal link. One link = one organization.

### White-Label Return URL

To customize "Back to [App]" button text and destination per customer:

```
Generate portal link with:
  return_url: "https://customer-subdomain.yourapp.com/settings"

WorkOS will show button as "Back to Customer Name"
```

**Pattern:** Use customer's branded subdomain in return URL for consistent UX.

### Certificate Renewal Flow

When SAML certificates expire, WorkOS sends `dsync.certificate_expiring_soon` event. To let IT admins renew:

1. Detect event in webhook handler
2. Email IT admin with link to: `https://yourapp.com/settings/sso/renew-cert`
3. That endpoint generates portal link with `intent: "certificate_renewal"`
4. Redirect immediately

**Why not email portal link directly?** Links expire in 5 minutes. Email delivery is not instant.

## Related Skills

- **workos-webhooks**: Handle Admin Portal events (`connection.activated`, etc.)
- **workos-sso-base**: Use SSO connections created via Admin Portal
- **workos-directory-sync**: Use Directory Sync connections from Admin Portal
- **workos-domain-verification**: Domain verification flow in Admin Portal
