<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal Integration

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Integration Path Decision

Determine which workflow to use:

```
Integration approach?
  |
  +-- Dashboard-only --> Skip to Step 7 (Manual Link Generation)
  |                      Use case: email links, low-touch setup
  |
  +-- SDK Integration --> Continue to Step 3
                         Use case: in-app self-service, seamless UX
```

**Critical:** Portal links expire in 5 minutes. Never email SDK-generated links — use dashboard links for async workflows.

## Step 3: Pre-Flight Validation

Check project has:
- `WORKOS_API_KEY` env var (starts with `sk_`)
- `WORKOS_CLIENT_ID` env var (starts with `client_`)
- WorkOS SDK installed (check `package.json` or equivalent)

## Step 4: Dashboard Configuration (REQUIRED)

Navigate to WorkOS Dashboard → Settings → Redirects:

1. **Default Return URI:** Where users land after closing portal (required, HTTPS only)
2. **Success URIs (optional):**
   - SSO Setup Success URI
   - Directory Sync Success URI
   - Log Streams Success URI

**Trap:** Missing redirect configuration causes "invalid redirect" errors at runtime. Configure BEFORE generating links.

## Step 5: Organization Management

### Create Organization Pattern

**When:** Onboarding a new customer that needs Admin Portal access

```
Customer signup flow?
  |
  +-- New enterprise customer --> Create organization via SDK
  |                               Store organization.id in your DB
  |
  +-- Existing customer --> Look up stored organization.id
```

Use SDK method for creating organizations — check fetched docs for exact method signature.

**Critical:** Each customer needs exactly ONE organization. Do NOT create multiple organizations per customer.

**Store the organization ID:** You need this ID to generate portal links. Map it to your customer record.

## Step 6: Generate Portal Links

### Intent Selection (Decision Tree)

```
What should IT admin configure?
  |
  +-- SSO connection --> intent: "sso"
  |
  +-- Directory sync --> intent: "dsync"
  |
  +-- Domain verification --> intent: "domain_verification"
  |
  +-- Audit log streams --> intent: "log_streams"
  |
  +-- Audit log setup --> intent: "audit_logs"
  |
  +-- Certificate renewal --> intent: "certificate_renewal"
```

Use SDK method for generating portal links with:
- `organization` - the organization ID
- `intent` - one of the intents above
- `return_url` (optional) - override default redirect

**Security note:** Portal link generation endpoint MUST be behind authentication. Only IT admins should access.

### Return URL Override Pattern

```
return_url behavior?
  |
  +-- Not provided --> Uses dashboard-configured default return URI
  |
  +-- Provided --> Overrides default, redirects to specific page
                   Use case: deep-link back to settings page
```

### Link Expiration Handling

Portal links expire 5 minutes after generation.

**Pattern for immediate redirect:**
```
1. Generate portal link
2. Immediately redirect user (same request cycle)
3. Do NOT store link or send in email
```

**Pattern for async workflows (email, etc.):**
- Use dashboard-generated links instead (longer lifetime)
- Dashboard: Organizations → Select org → "Invite admin" button

## Step 7: Manual Link Generation (Dashboard-Only Workflow)

For email/Slack sharing without SDK integration:

1. Dashboard → Organizations → Select organization
2. Click "Invite admin" button
3. Select features to enable
4. Either:
   - Enter IT admin email (sends automatically), OR
   - Copy link to share manually

**Limitation:** Only one active link per organization. Revoke existing link before creating new one.

## Step 8: Post-Setup Webhook Handling

When IT admin completes setup, WorkOS sends webhooks for:
- `connection.activated` (SSO configured)
- `dsync.activated` (Directory sync configured)
- `domain.verified` (Domain verification completed)

Check fetched docs for complete webhook event catalog and payload schemas.

**Pattern:** Use webhooks to update customer status in your DB, trigger onboarding flows, etc.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Verify SDK installed
npm list @workos-inc/node || pip show workos || bundle show workos

# 2. Verify env vars present (replace with your env var check)
env | grep WORKOS_API_KEY
env | grep WORKOS_CLIENT_ID

# 3. Verify organization creation works (run in REPL/test)
# Create test org, confirm it returns an ID

# 4. Verify portal link generation works
# Generate link with intent="sso", confirm it returns a valid URL

# 5. Verify redirect URIs configured in dashboard
# Dashboard → Settings → Redirects → Confirm default return URI exists
```

**Critical:** All checks must pass before deploying to production.

## Error Recovery

### "invalid redirect URI" at runtime

**Root cause:** Redirect URI not configured in dashboard, or uses HTTP instead of HTTPS.

**Fix:**
1. Dashboard → Settings → Redirects
2. Add default return URI (HTTPS required)
3. Regenerate portal link

### Portal link returns 404 or "expired"

**Root cause:** Link older than 5 minutes, or user refreshed stale link.

**Fix:**
1. Regenerate portal link immediately before redirect
2. Never store or cache portal links
3. For async workflows, use dashboard-generated links instead

### "organization not found" when generating link

**Root cause:** Organization ID mismatch between your DB and WorkOS.

**Fix:**
1. Query WorkOS for organization by external ID or name
2. Update stored ID in your DB
3. If organization missing, create new one

### Multiple organizations created for same customer

**Root cause:** Organization creation logic not idempotent.

**Fix:**
1. Check for existing organization before creating
2. Use external ID field to link WorkOS org to your customer ID
3. Query by external ID to retrieve organization

### IT admin can't access portal link

**Root cause:** Link generation endpoint not properly authenticated, or wrong user role.

**Fix:**
1. Add authentication middleware to link generation endpoint
2. Check user has "admin" or "IT admin" role before generating link
3. Return 403 if user lacks permissions

### Webhook events not received

**Root cause:** Webhook endpoint not configured or returning errors.

**Fix:**
1. Dashboard → Webhooks → Add endpoint URL
2. Verify endpoint returns 200 for test webhook
3. Check webhook signature verification (see Webhooks docs)
4. Review WorkOS webhook logs for delivery failures

## Related Skills

For authentication integration after Admin Portal setup:
- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-base
