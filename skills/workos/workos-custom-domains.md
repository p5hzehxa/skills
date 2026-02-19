---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs — they are the source of truth:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Check

```bash
# 1. Confirm production environment
grep "WORKOS_API_KEY=sk_prod_" .env || echo "WARN: Using staging key - custom domains only work in production"

# 2. Confirm dashboard access
echo "Navigate to https://dashboard.workos.com/ and verify production environment selected"
```

**CRITICAL:** Custom domains are a **paid production-only feature**. Staging environment always uses WorkOS defaults (`workos.dev` for email, `*.authkit.app` for AuthKit). Do not attempt configuration in staging.

### Pricing Verification

Check https://workos.com/pricing to confirm custom domains plan. If not on paid plan, stop here and upgrade before proceeding.

## Step 3: Domain Selection (Decision Tree)

```
Which service needs custom domain?
  |
  +-- Email (Magic Auth, Password Reset, Invites)
  |     |
  |     +-- Go to Step 4: Email Domain
  |
  +-- AuthKit (Login UI)
  |     |
  |     +-- Go to Step 5: AuthKit Domain
  |
  +-- Admin Portal
  |     |
  |     +-- Check fetched Admin Portal docs for configuration steps
  |
  +-- Multiple services
        |
        +-- Configure each separately (Steps 4, 5, and Admin Portal docs)
```

## Step 4: Email Domain Configuration

**Purpose:** Send authentication emails from `no-reply@your-domain.com` instead of `no-reply@workos.dev`.

**Use cases:** Magic Auth links, email verification, password resets, user invitations.

### 4.1: Navigate to Domain Settings

1. Open https://dashboard.workos.com/
2. **Verify production environment selected** (top-right selector)
3. Navigate to **Domains** section in sidebar

### 4.2: Add Email Domain

1. Click **Add Domain** button
2. Enter your domain (e.g., `example.com`)
3. Submit form

**Decision:** Subdomain vs root domain?

```
Domain choice?
  |
  +-- Root domain (example.com)
  |     --> Emails sent from no-reply@example.com
  |
  +-- Subdomain (auth.example.com)
        --> Emails sent from no-reply@auth.example.com
```

### 4.3: Create DNS Records

Dashboard will display **3 CNAME records** to add at your DNS provider.

**Pattern:**

```
Host                          Points To
---------------------------------------------
[random-string]._domainkey    [workos-value]
[random-string]._domainkey    [workos-value]
[random-string]._domainkey    [workos-value]
```

**DNS Provider Actions:**

1. Log into your DNS provider (Cloudflare, Route53, etc.)
2. Create 3 new CNAME records with **exact** values from dashboard
3. Save changes
4. Return to WorkOS Dashboard
5. Click **Verify Now** button

**Timing expectations:**

- DNS propagation: 5 minutes to 48 hours (typically < 1 hour)
- WorkOS retry window: 72 hours
- Verification status visible in dashboard

### 4.4: Verification Check

```bash
# Check CNAME records propagated
dig CNAME [random-string]._domainkey.your-domain.com

# Verify WorkOS sees records (check dashboard status)
echo "Dashboard should show 'Verified' status - if 'Pending' wait for DNS propagation"
```

**CRITICAL:** Do NOT delete CNAME records after verification. They must remain in place for email delivery to work.

## Step 5: AuthKit Domain Configuration

**Purpose:** Host AuthKit UI at `auth.your-domain.com` instead of `[random-phrase].authkit.app`.

**Use cases:** Login page, signup page, password reset UI.

### 5.1: Navigate to Domain Settings

Same as Step 4.1 — Dashboard > Domains section in production environment.

### 5.2: Add AuthKit Domain

1. Click **Configure AuthKit domain** button
2. Enter subdomain (e.g., `auth.example.com`)
3. Submit form

**Subdomain requirement:** AuthKit requires a subdomain, not root domain. Use `auth.`, `login.`, `sso.`, etc.

### 5.3: Create DNS Record

Dashboard will display **1 CNAME record** to add.

**Pattern:**

```
Host                Points To
-----------------------------------
auth.example.com    [workos-proxy-domain]
```

**Cloudflare Users (CRITICAL):**

If your DNS provider is Cloudflare:

1. Create CNAME record
2. Click the cloud icon to set **DNS-only** (grey cloud)
3. **DO NOT** leave as Proxied (orange cloud)

**Why:** WorkOS uses Cloudflare internally. Cloudflare blocks double-proxying across accounts.

**Verification:**

```bash
# Check CNAME points to WorkOS
dig CNAME auth.your-domain.com

# Verify not proxied (if using Cloudflare)
# Grey cloud icon in Cloudflare dashboard, not orange
```

### 5.4: Update Application Configuration

**CRITICAL:** After AuthKit domain verifies, update your app's redirect URIs.

**Pattern:**

```
Old callback URL:  https://[random].authkit.app/callback
New callback URL:  https://auth.your-domain.com/callback
```

**Actions:**

1. Update `WORKOS_REDIRECT_URI` in your `.env`
2. Update callback URL in WorkOS Dashboard under **Redirects** settings
3. If using AuthKit SDK, restart application to pick up new env var

**Verification:**

```bash
# Check env var updated
grep "WORKOS_REDIRECT_URI=.*your-domain.com" .env || echo "FAIL: Callback URL not updated"

# Test auth flow
# 1. Navigate to your app's login
# 2. Verify redirect goes to auth.your-domain.com, not authkit.app
# 3. Complete login
# 4. Verify callback succeeds
```

## Step 6: Auth API Custom Domain (Optional)

If using Auth API directly (not AuthKit SDK), check fetched Auth API docs for:

- Custom domain configuration for API endpoints
- Token endpoint customization
- OAuth flow adjustments

**Most applications using AuthKit SDK do NOT need this** — AuthKit handles API domain internally.

## Step 7: Admin Portal Custom Domain (Optional)

If using Admin Portal, check fetched Admin Portal docs for:

- Portal domain configuration
- Invitation email adjustments

**Decision:** Only needed if exposing Admin Portal to customers.

## Verification Checklist (ALL MUST PASS)

Run these checks in order. Do not mark complete until all pass.

```bash
# 1. Confirm production environment
echo "Dashboard environment selector shows: Production (not Staging)"

# 2. Email domain DNS records exist (if configured)
dig CNAME [first-dkim-record]._domainkey.your-domain.com | grep -q "CNAME" && echo "PASS: Email DNS configured" || echo "SKIP: Email not configured"

# 3. AuthKit domain DNS record exists (if configured)
dig CNAME auth.your-domain.com | grep -q "CNAME" && echo "PASS: AuthKit DNS configured" || echo "SKIP: AuthKit not configured"

# 4. Callback URL updated (if AuthKit configured)
grep "your-domain.com" .env | grep -q "REDIRECT_URI" && echo "PASS: Callback updated" || echo "SKIP: AuthKit not configured"

# 5. Dashboard shows verified status
echo "Check dashboard - all domains show 'Verified' not 'Pending'"

# 6. Test auth flow (if AuthKit configured)
echo "Manual test: Complete login flow and verify custom domain used"

# 7. Test email sending (if email configured)
echo "Manual test: Trigger password reset and verify email from your domain"
```

## Error Recovery

### "Domain verification pending after 24 hours"

**Root cause:** DNS records not propagated or incorrect values.

**Fix:**

1. Run `dig CNAME [record-host]` to check DNS propagation
2. Compare output to dashboard's expected values
3. Check for typos in CNAME host or target
4. If using Cloudflare, verify DNS-only mode (not proxied)
5. Wait up to 72 hours — WorkOS retries automatically

**If still failing after 72 hours:**

- Contact WorkOS support with domain name
- Provide `dig` output for all CNAME records

### "Cloudflare domain verification fails"

**Root cause:** CNAME record set to Proxied (orange cloud) instead of DNS-only (grey cloud).

**Fix:**

1. Open Cloudflare dashboard
2. Find CNAME record for AuthKit domain
3. Click orange cloud icon to toggle to grey (DNS-only)
4. Return to WorkOS dashboard and click Verify Now

**Why:** Cloudflare prohibits proxying across accounts. WorkOS requires direct DNS resolution.

### "AuthKit callback fails after custom domain"

**Root cause:** Application still using old `authkit.app` callback URL.

**Fix:**

1. Check `WORKOS_REDIRECT_URI` in `.env` — must match custom domain
2. Check WorkOS Dashboard > Redirects — must include custom domain callback
3. Restart application to load new env var
4. Clear browser cookies/cache to remove old session

**Pattern:**

```
Correct:   WORKOS_REDIRECT_URI=https://auth.your-domain.com/callback
Incorrect: WORKOS_REDIRECT_URI=https://random.authkit.app/callback
```

### "Email still coming from workos.dev"

**Root cause:** Using staging environment or CNAME records not verified.

**Fix:**

1. Verify dashboard environment selector shows "Production"
2. Check email domain status in dashboard — must say "Verified"
3. Verify CNAME records exist via `dig`
4. Wait 5-10 minutes after verification for changes to propagate

**If verified but still wrong domain:**

- Trigger new email (password reset, magic link)
- Check spam folder for emails from your domain
- Contact WorkOS support if issue persists

### "DNS changes not taking effect"

**Root cause:** DNS caching or propagation delay.

**Fix:**

1. Wait 1 hour minimum for DNS propagation
2. Use online DNS checker (whatsmydns.net) to verify global propagation
3. Flush local DNS cache:
   - macOS: `sudo dscacheutil -flushcache`
   - Windows: `ipconfig /flushdns`
   - Linux: `sudo systemd-resolve --flush-caches`
4. WorkOS will retry verification for 72 hours — no manual action needed

### "Custom domain not available in staging"

**Expected behavior:** Custom domains are production-only.

**Action:**

- Continue development using default WorkOS domains
- Configure custom domains only after deploying to production
- Update environment variables during production deployment

## Related Skills

- workos-authkit-nextjs — AuthKit integration patterns (callback URL configuration)
- workos-authkit-react — Client-side auth UI (redirect URI updates)
