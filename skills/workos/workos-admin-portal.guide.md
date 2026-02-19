<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- `https://workos.com/docs/admin-portal/index`
- `https://workos.com/docs/admin-portal/example-apps`
- `https://workos.com/docs/admin-portal/custom-branding`

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### WorkOS Credentials

Check environment variables or secrets store:

- `WORKOS_API_KEY` — starts with `sk_`
- `WORKOS_CLIENT_ID` — starts with `client_`

**Verify:** Both keys exist and are non-empty before continuing.

### SDK Installation

Detect SDK package in dependency manifest (`package.json`, `requirements.txt`, etc.).

**Verify:** SDK package exists before importing.

## Step 3: Integration Pattern Decision (Decision Tree)

```
Integration approach?
  |
  +-- Dashboard-only (no code)
  |   |
  |   +-- Use Case: One-off onboarding, manual invites
  |   +-- Steps: Dashboard → Organizations → "Invite admin" button
  |   +-- Result: WorkOS sends email with setup link
  |   +-- SKIP Step 4-7, END here
  |
  +-- Application-integrated (SDK/API)
      |
      +-- Use Case: Programmatic access, embedded in app settings
      +-- Steps: Continue to Step 4
      +-- Result: Generate portal links on-demand in your code
```

**Critical:** Portal links expire 5 minutes after creation. Never email them. Generate immediately before redirect.

## Step 4: Dashboard Configuration (REQUIRED for SDK integration)

Navigate to WorkOS Dashboard → Admin Portal → Redirect Links tab.

### Default Return URI

Set where users land when clicking "Return to [App]" button in portal.

**Format:** `https://yourdomain.com/settings` (HTTPS required)

**CRITICAL:** If return URI is not configured, portal links will fail. Set this BEFORE generating any links.

### Success URIs (Optional)

Configure where users land after completing specific setup tasks:

- SSO success → e.g., `https://yourdomain.com/settings/sso/complete`
- Directory Sync success → e.g., `https://yourdomain.com/settings/dsync/complete`
- Log Streams success → e.g., `https://yourdomain.com/settings/logs/complete`

**Pattern:** Success URIs override default return URI for successful completions only.

## Step 5: Organization Management

### Organization-Connection Mapping (CRITICAL)

```
Constraint: 1 Organization = 1 Connection

Your customer "Acme Corp"
  ↓
WorkOS Organization (org_123)
  ↓
ONE of: SSO Connection OR Directory OR Log Stream

Multiple customers = Multiple organizations
```

**Trap:** Do NOT create multiple organizations for the same customer. One org per customer.

### When to Create Organizations

```
Trigger                     → Action
─────────────────────────── → ──────────────────────
New enterprise customer     → Create organization
Existing customer upgrades  → Create organization (if not exists)
Free tier user             → DO NOT create (no Admin Portal access)
```

Check fetched docs for SDK method to create organizations — include customer name and domain(s).

**Store the organization ID** in your database. You need it to generate portal links.

## Step 6: Generate Portal Links

### Intent Selection (Decision Tree)

```
What is user configuring?
  |
  +-- SSO                    → intent: "sso"
  +-- Directory Sync         → intent: "dsync"
  +-- Audit Logs             → intent: "audit_logs"
  +-- Log Streams            → intent: "log_streams"
  +-- Domain Verification    → intent: "domain_verification"
  +-- Certificate Renewal    → intent: "certificate_renewal"
```

Use SDK method for generating portal links with:

- `organization` — the org ID from Step 5
- `intent` — from decision tree above
- `return_url` (optional) — overrides dashboard default for this session

**Critical Security Pattern:**

1. User requests access to portal (e.g., clicks "Configure SSO" in your app)
2. Verify user is authorized (IT admin for that customer)
3. Generate portal link with 5-minute expiry
4. **IMMEDIATELY** redirect user to link URL
5. **NEVER** store link, email it, or delay redirect

**Trap:** If you store the link or delay redirect, it will expire. Generate on-demand only.

## Step 7: Return Flow Handling

### Success vs. Cancel

```
User action in portal       → Redirect destination
─────────────────────────── → ─────────────────────────
Completes SSO setup         → Success URI (if set)
                              OR Default Return URI
Clicks "Return to [App]"    → Default Return URI
                              (without completing setup)
```

**Pattern:** Success URIs are per-feature. Set them if you need to show feature-specific confirmation UI.

Check fetched docs for webhook events if you need server-side notification of setup completion.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Credentials exist
env | grep WORKOS_API_KEY | grep -q "^WORKOS_API_KEY=sk_" && echo "PASS" || echo "FAIL: Invalid API key"

# 2. Dashboard redirect URI configured
# Manual check: Visit https://dashboard.workos.com/redirects
# Verify "Default Return URI" is set and uses HTTPS

# 3. Test organization creation (requires working SDK)
# Run SDK test command from fetched docs

# 4. Test portal link generation
# Generate link with organization ID from step 3
# Verify URL starts with https://workos.com/portal/

# 5. Test link expiry
# Generate link, wait 6 minutes, try to access
# Should show "Link expired" error
```

## Error Recovery

### "Portal link generation failed: organization not found"

**Root cause:** Organization ID doesn't exist or was deleted.

Fix:
1. Query your database for stored organization ID
2. Verify ID exists in WorkOS dashboard (Organizations tab)
3. If missing, re-create organization and update database reference

### "Redirect URI not configured"

**Root cause:** Dashboard default return URI not set.

Fix:
1. Go to Dashboard → Admin Portal → Redirect Links
2. Set "Default Return URI" to HTTPS URL in your app
3. Save and retry portal link generation

### "Invalid intent"

**Root cause:** Typo in intent string or unsupported intent.

Valid intents from docs: `sso`, `dsync`, `audit_logs`, `log_streams`, `domain_verification`, `certificate_renewal`

Fix:
1. Check intent string matches exactly (case-sensitive)
2. Consult fetched docs for newly added intents

### "SDK import failed"

**Root cause:** SDK not installed or wrong package name.

Fix:
1. Check fetched docs for exact SDK package name
2. Install SDK using package manager
3. Verify `node_modules/` or equivalent contains SDK package

### "User sees expired link"

**Root cause:** Link generated too early or user delayed.

Fix:
1. Move link generation to immediately before redirect
2. Never pre-generate links for later use
3. If user reports expired link, generate new one on their next attempt

### "User stuck in portal after completion"

**Root cause:** Return URI misconfigured or success URI not working.

Fix:
1. Check Dashboard → Redirect Links for valid HTTPS URLs
2. Verify URLs resolve and don't 404
3. Test success URI by completing setup flow manually

### "Multiple connections for same organization"

**Root cause:** Violating 1-org-1-connection constraint.

Fix:
1. Check WorkOS dashboard for duplicate connections under organization
2. Delete extra connections (keep most recent)
3. Review application logic to prevent creating multiple intents per org

## Integration Patterns

### Embedded Settings Page Pattern

```
Your app settings page (/settings)
  ↓
"Configure SSO" button
  ↓
Backend endpoint (auth-guarded)
  1. Verify user is IT admin
  2. Lookup organization ID for user's company
  3. Generate portal link with intent="sso"
  4. Return redirect response
  ↓
User lands in WorkOS Admin Portal
  ↓
After setup, returns to return_url
```

### Multi-Feature Settings Pattern

```
Settings page with multiple sections:
  - SSO Configuration button → intent="sso"
  - Directory Sync button    → intent="dsync"
  - Audit Logs button        → intent="audit_logs"

Each button hits same endpoint with different intent parameter.
```

### First-Time Onboarding Pattern

```
User signs contract for Enterprise plan
  ↓
Application provisions organization
  ↓
Welcome email with CTA: "Complete Setup"
  ↓
CTA links to authenticated route in your app
  ↓
Route generates portal link with intent="sso"
  ↓
Immediate redirect (not emailed link)
```

**Trap:** Do not email portal links directly. Email a CTA that links to your app, which then generates and redirects.

## Related Skills

- workos-authkit-nextjs — For end-user authentication after SSO is configured
- workos-authkit-react — For client-side authentication UI
