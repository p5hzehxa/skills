---
name: workos-admin-portal
description: Enable self-service admin portal for your enterprise customers.
---

<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these in your environment config (`.env`, `.env.local`, or secrets manager):

```bash
# Verify both keys exist and match patterns
grep "WORKOS_API_KEY" .env* || echo "FAIL: WORKOS_API_KEY missing"
grep "WORKOS_CLIENT_ID" .env* || echo "FAIL: WORKOS_CLIENT_ID missing"
```

Expected formats:
- `WORKOS_API_KEY` starts with `sk_`
- `WORKOS_CLIENT_ID` starts with `client_`

### SDK Installation

Confirm WorkOS SDK is installed before writing integration code:

```bash
# Check package.json or equivalent dependency manifest
grep -E "(workos|@workos-inc)" package.json Gemfile requirements.txt go.mod pom.xml composer.json 2>/dev/null
```

If not found, install SDK using project's package manager. Check fetched docs for language-specific installation commands.

## Step 3: Workflow Decision Tree

Admin Portal has TWO integration patterns. Choose based on your auth architecture:

```
How will IT admins access Admin Portal?
  |
  +-- Email/external link (no app integration)
  |     |
  |     +-- Use dashboard-generated shareable links (Step 4A)
  |     +-- Skip Step 5-6
  |
  +-- In-app redirect (seamless integration)
        |
        +-- Configure redirect URIs (Step 4B)
        +-- Implement portal link generation (Step 5)
        +-- Create redirect endpoint (Step 6)
```

**Decision criteria:**
- **Email/external**: IT admin isn't a user in your app, or you want async setup
- **In-app redirect**: IT admin has authenticated session, seamless UX preferred

## Step 4A: Dashboard-Generated Links (Non-Integrated Path)

Skip this if you chose "In-app redirect" in Step 3.

### Create Organization in Dashboard

1. Sign into WorkOS dashboard
2. Navigate to Organizations section
3. Click "Create organization"
4. Record organization ID (format: `org_XXXXX`)

### Generate Shareable Link

1. Click "Invite admin" for the organization
2. Select features to enable (SSO, Directory Sync, Domain Verification, etc.)
3. Choose:
   - Enter IT admin email → WorkOS sends invitation
   - Copy link → Share manually via email/Slack/DM

**Link lifecycle:**
- Only ONE link active per organization at a time
- To create new link, revoke existing via "Manage" button
- Links expire 5 minutes after creation

**STOP here if using dashboard links. Skip to Step 7.**

## Step 4B: Configure Redirect URIs (In-App Path)

**CRITICAL:** This step is REQUIRED for in-app integration. SDK calls will fail without proper redirect configuration.

### Production Environment Setup

Navigate to WorkOS dashboard → Admin Portal → Redirect Links

Configure these URIs (all MUST use HTTPS):

1. **Default return URI**: Where users land after clicking "Return to App" button
   - Example: `https://yourapp.com/admin/settings`
   - Used if no `return_url` specified when generating portal link

2. **Success URIs** (optional but recommended):
   - SSO success: `https://yourapp.com/admin/sso/complete`
   - Directory Sync success: `https://yourapp.com/admin/directory/complete`
   - Log Streams success: `https://yourapp.com/admin/logs/complete`

**Verification command:**

```bash
# Confirm HTTPS in your config
grep -E "https://" .env* | grep -v "localhost"
```

If using localhost for dev, create separate test environment in dashboard.

## Step 5: Organization Resource Management

### When to Create Organizations

Create WorkOS organization resource when:
- New customer signs up for your product
- Existing customer upgrades to enterprise tier
- Customer requests SSO/Directory Sync access

**Pattern: One organization per customer company** — do NOT create multiple orgs for departments/teams within same customer.

### Create Organization via SDK

Use SDK's organization creation method. Check fetched docs for exact method signature in your language.

**Required parameters:**
- `name`: Customer company name
- `domains`: Array of verified domains (optional at creation, required for SSO)

**Store organization ID** — you'll need it for every portal link generation:

```bash
# Verify org ID storage in your database
# Expected format: org_XXXXX (26 character alphanumeric after prefix)
```

### Database Schema Pattern

Recommended table structure for tracking organizations:

```
customers table:
  - id (your internal customer ID)
  - workos_organization_id (format: org_XXXXX)
  - is_enterprise (boolean flag for portal access)
```

Query pattern: `SELECT workos_organization_id FROM customers WHERE id = ?`

## Step 6: Portal Link Generation and Redirect

### Endpoint Architecture

Create protected endpoint at `/admin/portal` or similar. **CRITICAL:** This endpoint MUST:

1. Require authentication (IT admin logged into your app)
2. Verify user has admin role for the organization
3. Fetch WorkOS organization ID from your database
4. Generate portal link via SDK
5. Redirect immediately (links expire in 5 minutes)

### Intent Selection (Decision Tree)

Portal links require an `intent` parameter specifying what the IT admin can configure:

```
What should IT admin configure?
  |
  +-- SSO (SAML/OIDC connections) --> intent: "sso"
  |
  +-- Directory Sync (SCIM/LDAP) --> intent: "dsync"
  |
  +-- Domain Verification --> intent: "domain_verification"
  |
  +-- Audit Log Streams --> intent: "log_streams"
  |
  +-- Audit Log Export --> intent: "audit_logs"
  |
  +-- SAML Certificate Renewal --> intent: "certificate_renewal"
```

Use SDK method for generating portal link with:
- `organization_id` (from your database)
- `intent` (from decision tree above)
- `return_url` (optional override of dashboard default)

Check fetched docs for exact method signature.

### Return URL Strategy

```
return_url provided in API call?
  |
  +-- YES --> User redirected to this URL when done
  |
  +-- NO  --> User redirected to dashboard-configured success URI for that intent
```

**Pattern for return URLs:**
- Include customer context: `/admin/settings?org_id={customer_id}`
- Add success flag: `/admin/settings?portal_complete=true`
- Avoid sensitive data in query params

### Redirect Flow Pseudocode

```
1. Authenticate user
2. Verify user is admin for customer organization
3. Fetch workos_organization_id from database
4. Generate portal link:
   - Call SDK portal link method
   - Provide: organization_id, intent, optional return_url
5. Redirect user to portal link URL (302/307 redirect)
6. User completes setup in Admin Portal
7. User clicks "Return to App" → redirected to return_url
```

**CRITICAL:** Do NOT email portal links — they expire in 5 minutes. Redirect must be immediate.

## Step 7: Portal User Experience Flow

### What IT Admins See

After redirect to portal link, IT admin experiences:

1. **IdP Selection**: Choose identity provider (Okta, Azure AD, Google, etc.)
2. **Guided Setup**: Provider-specific configuration instructions
3. **Credential Entry**: Input IdP credentials (client ID, secrets, certificates)
4. **Connection Testing**: WorkOS validates configuration
5. **Return to App**: Button using configured return URI

### Common Configuration Fields by Intent

**SSO (intent: "sso"):**
- IdP selection
- SAML metadata or OIDC client credentials
- Attribute mappings

**Directory Sync (intent: "dsync"):**
- Directory provider selection
- SCIM bearer token or LDAP credentials
- Sync frequency settings

**Domain Verification (intent: "domain_verification"):**
- Domain name entry
- DNS record creation (TXT or CNAME)
- Verification confirmation

Check fetched docs for complete field lists per intent.

## Step 8: Post-Setup Integration

### Webhook Configuration (RECOMMENDED)

Set up webhooks to receive notifications when:
- Connection is created/updated/deleted
- Domain is verified
- Directory sync completes

Navigate to dashboard → Webhooks to configure endpoint and events.

### Connection State Verification

After IT admin completes portal setup, verify connection active:

```bash
# Query connections for organization
# Check fetched docs for SDK method to list connections by organization ID
```

Expected connection states:
- `active`: Ready to use
- `inactive`: Configuration incomplete
- `validating`: WorkOS verifying credentials

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Environment variables set correctly
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)" | wc -l
# Expected: 2

# 2. SDK package installed
find . -type d -name "*workos*" | head -1
# Expected: node_modules/@workos-inc or similar

# 3. Redirect URIs configured (check dashboard manually)
echo "Verify in dashboard: All URIs use HTTPS (except localhost in test env)"

# 4. Organization creation endpoint exists (adjust path to your app structure)
grep -r "organization" app/ src/ --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go"

# 5. Portal link endpoint exists and is protected
grep -r "portal" app/ src/ --include="*.ts" --include="*.js" --include="*.py" --include="*.rb" --include="*.go" | grep -E "(auth|require|protect|guard)"

# 6. Application builds
npm run build || bundle exec rake build || python setup.py build || go build
```

All checks must return results or pass. If any fail, revisit corresponding step.

## Error Recovery

### "Portal link expired"

**Root cause:** More than 5 minutes elapsed between link generation and user redirect.

**Fix:**
1. Generate new link immediately before redirect
2. Do NOT store links in database or send via email
3. Pattern: generate → redirect in same request handler

### "Invalid organization ID"

**Root cause:** Organization ID format wrong or org deleted in dashboard.

**Fix:**
1. Verify org ID format: `org_` prefix + 26 alphanumeric characters
2. Check dashboard: Organization still exists and active
3. Query your database: Ensure org ID not corrupted or null

### "Redirect URI mismatch"

**Root cause:** `return_url` parameter doesn't match dashboard-configured allowed URIs.

**Fix:**
1. Dashboard → Admin Portal → Redirect Links
2. Add missing URI to allowed list
3. OR omit `return_url` parameter to use dashboard default
4. Verify URIs use HTTPS (HTTP only allowed for localhost)

### "Invalid intent parameter"

**Root cause:** Intent value not in allowed list.

**Fix:**
1. Check intent matches one of: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`
2. Check for typos (e.g., `directory_sync` instead of `dsync`)
3. Verify intent is supported for your WorkOS plan (check dashboard)

### "API key invalid" or "Unauthorized"

**Root cause:** API key wrong, expired, or lacks permissions.

**Fix:**
1. Verify API key starts with `sk_` prefix
2. Dashboard → API Keys: Confirm key active and not deleted
3. Check key is for correct environment (test vs. production)
4. Rotate key if compromised: Dashboard → API Keys → Regenerate

### SDK import fails

**Root cause:** SDK not installed or version incompatible.

**Fix:**
1. Reinstall SDK package: `npm install @workos-inc/node` or equivalent
2. Check fetched docs for minimum supported SDK version
3. Clear package cache and reinstall
4. For TypeScript: Ensure types are installed (`@types/workos` if needed)

### "Connection not found after setup"

**Root cause:** Connection created but not yet active, or webhook not processed.

**Fix:**
1. Check connection state via SDK (list connections for organization)
2. Wait for `connection.activated` webhook before enabling SSO in your app
3. Dashboard → Organizations → [Org] → Connections: Verify connection shows as active
4. If stuck in `validating` state, IT admin may need to re-configure in portal

## Related Skills

- **workos-authkit-nextjs**: Integrate AuthKit for user authentication with SSO connections
- **workos-authkit-react**: Client-side auth with SSO
- **workos-directory-sync**: Sync user directories configured via Admin Portal
