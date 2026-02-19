<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth for DNS record requirements and verification steps:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Account Requirements

- Confirm WorkOS production environment access (staging does NOT support custom domains)
- Confirm custom domains feature is enabled for account (paid feature — check pricing page)
- Have DNS provider credentials ready (Cloudflare, Route53, etc.)

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Critical:** Custom domains only apply to production environment. Staging always uses WorkOS-provided domains (`workos.dev` for email, `*.authkit.app` for AuthKit).

## Step 3: Domain Type Decision Tree

```
What are you customizing?
  |
  +-- Email (Magic Auth, password resets, invites)
  |     --> Section 4A: Email Domain Setup
  |
  +-- AuthKit (hosted auth UI)
  |     --> Section 4B: AuthKit Domain Setup
  |
  +-- Admin Portal
        --> Check fetched docs for Admin Portal DNS requirements
```

**Note:** You can configure multiple domain types. Complete each section independently.

## Section 4A: Email Domain Setup

### Step 1: Navigate to Dashboard

1. Open WorkOS Dashboard: `https://dashboard.workos.com/`
2. Switch to **Production** environment (top-right selector)
3. Navigate to **Domains** section (left sidebar)

**Verify:** URL shows `/domains` path and "Production" badge is visible.

### Step 2: Initiate Email Domain

1. Click **Add Domain** button
2. Enter your sending domain (e.g., `example.com`)
   - This will be used as: `no-reply@example.com`
   - Do NOT include protocol (`https://`) or subdomain unless intended
3. Select **Email** as domain type
4. Click **Add**

**Critical:** Domain must be one you control and can modify DNS records for.

### Step 3: DNS Record Configuration

Dashboard will display 3 CNAME records. For each record:

```
Record structure from WorkOS:
  Name: [subdomain].example.com
  Type: CNAME
  Value: [workos-provided-value].workos.dev
  TTL: 3600 (or your DNS provider's default)
```

**Action required:**

1. Log into your DNS provider
2. Create all 3 CNAME records exactly as shown
3. Do NOT modify the values — copy-paste from dashboard

**DNS Provider-Specific Notes:**

- **Cloudflare:** CNAME records MUST be "DNS only" (gray cloud), NOT proxied (orange cloud)
- **Route53:** Use simple routing policy
- **Namecheap/GoDaddy:** May show "Host" field instead of "Name" — enter the subdomain part only

### Step 4: Trigger Verification

1. After creating all 3 DNS records, return to WorkOS Dashboard
2. Click **Verify now** button

**Expected outcomes:**

```
Immediate success
  --> Domain status: "Verified" (green)
  --> Section complete

Verification pending
  --> Domain status: "Pending verification"
  --> WorkOS will auto-retry for 72 hours
  --> Check DNS propagation: dig [record-name] CNAME
  --> Wait 5-15 minutes, check dashboard again

Verification failed after 72 hours
  --> Check DNS records match dashboard exactly
  --> Run: dig [record-name] CNAME +short
  --> Ensure TTL has passed since record creation
  --> Correct records, click "Verify now" again
```

### Step 5: Verify Email Sending

Test that emails now come from your domain:

```bash
# Trigger a test email (password reset, magic auth, etc.)
# Check email headers for:
From: no-reply@[your-domain.com]
Return-Path: [verification-value]@workos.dev

# If still seeing @workos.dev in From field:
# - Check domain status in dashboard (must be "Verified")
# - Check production environment is active
# - Wait 5 minutes for configuration propagation
```

## Section 4B: AuthKit Domain Setup

### Step 1: Navigate to Dashboard

1. Open WorkOS Dashboard: `https://dashboard.workos.com/`
2. Switch to **Production** environment
3. Navigate to **Domains** section

### Step 2: Initiate AuthKit Domain

1. Click **Configure AuthKit domain** button
2. Enter your auth subdomain (e.g., `auth.example.com`)
   - Common patterns: `auth.`, `login.`, `accounts.`
   - This will be the URL users see for AuthKit UI
3. Click **Configure**

**Critical:** Choose a subdomain, not your root domain. AuthKit requires CNAME, which conflicts with root domain A/AAAA records.

### Step 3: DNS Record Configuration

Dashboard will display 1 CNAME record:

```
Record from WorkOS:
  Name: auth.example.com
  Type: CNAME
  Value: [workos-provided].authkit.app
  TTL: 3600
```

**Action required:**

1. Log into your DNS provider
2. Create the CNAME record exactly as shown

**Cloudflare CRITICAL WARNING:**

If using Cloudflare as DNS provider:

- MUST set proxy status to **DNS only** (gray cloud icon)
- DO NOT use **Proxied** (orange cloud)
- Reason: WorkOS uses Cloudflare for custom domains; Cloudflare prohibits cross-account proxying

**Verification command:**

```bash
# Check CNAME resolution
dig auth.example.com CNAME +short
# Should return: [something].authkit.app

# If returns nothing or wrong value:
# - DNS records not propagated yet (wait 5-15 min)
# - Record created incorrectly (double-check dashboard values)
```

### Step 4: Trigger Verification

1. Click **Verify now** in dashboard
2. Wait for "Verified" status (same retry logic as email domain)

### Step 5: Update Application Configuration

**CRITICAL:** After domain verification, update your app's AuthKit configuration:

```
Old redirect URI: https://youthful-ginger-43.authkit.app/callback
New redirect URI: https://auth.example.com/callback

Action required:
1. Update WORKOS_REDIRECT_URI env var
2. Update redirect URI in WorkOS Dashboard (Redirects section)
3. Redeploy application
```

**Verification:**

```bash
# Test auth flow redirects to custom domain
curl -I https://auth.example.com
# Should return 200 or redirect, NOT 404

# Check SSL certificate
echo | openssl s_client -connect auth.example.com:443 2>/dev/null | grep subject
# Should show valid cert for your domain
```

## Section 5: Admin Portal Custom Domain (Optional)

If you need to customize Admin Portal domain (not common):

1. Check fetched docs for Admin Portal DNS requirements
2. Follow similar CNAME pattern as AuthKit
3. Update Admin Portal configuration in dashboard

**Pattern will be:**

- Subdomain like `admin.example.com` or `portal.example.com`
- Single CNAME record pointing to WorkOS infrastructure
- Update Admin Portal URL in your application's SSO setup code

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm setup:

```bash
# 1. Email domain DNS records (if configured)
for record in [record1] [record2] [record3]; do
  dig $record CNAME +short | grep -q workos && echo "✓ $record" || echo "✗ $record MISSING"
done

# 2. AuthKit domain DNS record (if configured)
dig auth.example.com CNAME +short | grep -q authkit.app && echo "✓ AuthKit CNAME" || echo "✗ AuthKit CNAME MISSING"

# 3. Dashboard verification status
# Manual check: All domains show "Verified" in dashboard (no command for this)

# 4. Email test (if email domain configured)
# Trigger password reset or magic auth
# Confirm From: header shows your domain

# 5. AuthKit test (if AuthKit domain configured)
curl -I https://auth.example.com | grep -q "200\|302" && echo "✓ AuthKit responding" || echo "✗ AuthKit not responding"

# 6. Environment check
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "✓ API key format" || echo "✗ API key invalid"
```

## Error Recovery

### "Domain verification failed"

**Root cause tree:**

```
DNS records incorrect
  --> Run: dig [record-name] CNAME +short
  --> Compare output to dashboard values
  --> If mismatch: delete DNS record, recreate exactly as shown
  --> If timeout: wait 15 minutes for propagation

Cloudflare proxy enabled (AuthKit only)
  --> Log into Cloudflare
  --> Find CNAME record
  --> Click orange cloud to change to gray (DNS only)
  --> Wait 5 minutes, retry verification

TTL not passed
  --> Check original TTL value when record was created
  --> Wait full TTL duration (often 3600 seconds = 1 hour)
  --> Retry verification after TTL expires
```

### "Emails still coming from @workos.dev"

**Fix:**

1. Check WorkOS Dashboard shows domain as "Verified" (not "Pending")
2. Confirm you are in Production environment (check top-right badge)
3. Wait 5 minutes for configuration propagation
4. Ensure all 3 CNAME records are still present (check DNS)
5. Check DNS records haven't expired or been auto-deleted by provider

### "AuthKit shows SSL certificate error"

**Root cause:** DNS not yet propagated or CNAME misconfigured.

**Fix:**

```bash
# Check CNAME resolution
dig auth.example.com CNAME +short
# Should return *.authkit.app value

# If returns empty:
# - CNAME not created or wrong name
# - DNS provider hasn't propagated yet

# If returns wrong value:
# - Delete CNAME, recreate from dashboard values
```

WorkOS automatically provisions SSL certificates once CNAME is verified. If CNAME is correct, wait 10-15 minutes for SSL provisioning.

### "Dashboard says 'CNAME already in use'"

**Root cause:** Domain is claimed by another WorkOS account or has conflicting DNS.

**Fix:**

1. Verify you own the domain (check registrar)
2. Check for existing CNAME records that might conflict:
   ```bash
   dig auth.example.com CNAME +short
   ```
3. If record points to different service, you must choose different subdomain
4. If record points to WorkOS but you don't see it in dashboard: contact WorkOS support (possible orphaned domain)

### "Staging environment not working with custom domain"

**Expected behavior:** Custom domains are production-only feature.

**Fix:** None needed. Staging always uses:

- Email: `@workos.dev`
- AuthKit: `[random-phrase].authkit.app`

This is by design. Test custom domain integration in production only.

## Related Skills

- workos-authkit-nextjs (update redirect URIs after AuthKit domain configured)
- workos-authkit-react (update redirect URIs after AuthKit domain configured)
