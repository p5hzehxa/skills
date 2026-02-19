<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest DNS requirements and verification steps:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

```bash
# Confirm production environment access
echo $WORKOS_API_KEY | grep -q "^sk_" && echo "PASS: API key format valid" || echo "FAIL: Invalid API key"

# Verify WorkOS Dashboard access
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" https://api.workos.com/environments | grep -q "production"
```

### Domain Ownership Requirements

**CRITICAL:** You must have DNS control over the domain you're configuring. Verify:

- Domain is registered and active
- DNS provider allows CNAME record creation
- You have credentials to modify DNS records

**Trap:** Some DNS providers (e.g., some shared hosting) don't allow CNAME records at root domains. Plan to use subdomains (`auth.example.com`, not `example.com`) if this applies.

## Step 3: Custom Domain Selection (Decision Tree)

```
What are you configuring?
  |
  +-- Email (Magic Auth, password resets, invites)
  |     |
  |     +-- Use: mail.example.com or example.com
  |     +-- Result: Emails sent from no-reply@your-domain.com
  |     +-- CNAME count: 3 records required
  |
  +-- AuthKit (hosted auth UI)
  |     |
  |     +-- Use: auth.example.com or login.example.com
  |     +-- Result: AuthKit UI served from your domain
  |     +-- CNAME count: 1 record required
  |     +-- Cloudflare users: MUST disable proxy (DNS-only mode)
  |
  +-- Admin Portal (organization admin UI)
        |
        +-- Use: admin.example.com or portal.example.com
        +-- Result: Admin Portal served from your domain
        +-- Check fetched docs for CNAME requirements
```

**Decision factors:**

- **Email domain:** Should match your product's "from" address expectations
- **AuthKit domain:** Should feel secure to users (e.g., `auth.` prefix common)
- **Admin Portal domain:** Should clearly indicate administrative context

**Cannot use same domain for multiple services** — each needs distinct subdomain.

## Step 4: Dashboard Configuration

### Navigate to Domains Section

1. Log into [WorkOS Dashboard](https://dashboard.workos.com/)
2. **CRITICAL:** Switch to **Production environment** (staging always uses WorkOS domains)
3. Navigate to **Domains** section (check fetched docs for exact navigation path)

### Add Domain (Service-Specific Steps)

For **Email Domain:**

- Click "Add Domain"
- Enter domain (e.g., `mail.example.com`)
- Dashboard will generate 3 CNAME records

For **AuthKit Domain:**

- Click "Configure AuthKit domain"
- Enter domain (e.g., `auth.example.com`)
- Dashboard will generate 1 CNAME record

**Trap:** Dashboard shows records immediately, but they're NOT active until DNS verification completes (Step 5).

## Step 5: DNS Record Creation (CRITICAL)

### Copy CNAME Records from Dashboard

Dashboard displays records in this format:

```
Type    Host                    Value
CNAME   <subdomain>             <target>.workos.com
```

**CRITICAL:** Copy values EXACTLY. Typos will cause verification failure.

### Create Records with DNS Provider

**General pattern:**

1. Log into your DNS provider (Cloudflare, Route53, etc.)
2. Navigate to DNS management for your domain
3. Add each CNAME record with values from dashboard

**Cloudflare-specific requirement (AuthKit ONLY):**

- Set CNAME to **DNS-only mode** (gray cloud icon)
- **NEVER** enable proxy mode (orange cloud) — WorkOS uses Cloudflare and cannot proxy across accounts
- Verification will FAIL if proxying is enabled

### DNS Provider Variations (Common Traps)

| Provider | Trap | Fix |
|----------|------|-----|
| Cloudflare | Proxy mode enabled by default | Click cloud icon to disable proxy |
| Route53 | Requires trailing dot in target | Add `.` to end of CNAME value |
| GoDaddy | Auto-appends domain to host | Enter ONLY subdomain prefix (not FQDN) |
| Namecheap | Slow propagation (6+ hours) | Create records early, be patient |

### Verification Timeline

DNS propagation is NOT instant:

- **Typical:** 15 minutes to 2 hours
- **Maximum:** 72 hours (WorkOS retries automatically)

**During this window:**

- Dashboard shows "Pending verification"
- WorkOS checks DNS every few minutes
- Emails still send from `workos.dev` (email domain)
- AuthKit still uses `*.authkit.app` domain

**You do NOT need to stay on dashboard page** — verification happens automatically in background.

## Step 6: Verify Configuration

### Check DNS Propagation

```bash
# Check email domain CNAMEs (replace with your actual values)
dig +short CNAME <host1-from-dashboard>
dig +short CNAME <host2-from-dashboard>
dig +short CNAME <host3-from-dashboard>

# Check AuthKit domain CNAME
dig +short CNAME auth.example.com
```

**Expected output:** Each command should return a `*.workos.com` or `*.cloudflare.com` target.

**If empty:** DNS records not yet propagated. Wait and retry.

### Check Dashboard Verification Status

```bash
# Dashboard API check (if available in fetched docs)
# Otherwise manually check dashboard UI
```

### Test Email Domain (After Verification)

Trigger an authentication email (password reset, magic link) and verify:

- Sender shows `no-reply@your-domain.com`
- Email deliverability is good (check spam folder)
- SPF/DKIM headers reference your domain

### Test AuthKit Domain (After Verification)

Visit AuthKit URL and verify:

- Browser shows your custom domain in address bar
- SSL certificate is valid (no warnings)
- AuthKit UI loads correctly

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Environment is production
echo $WORKOS_API_KEY | grep -q "^sk_live" && echo "PASS" || echo "FAIL"

# 2. DNS records exist and propagated
dig +short CNAME your-email-domain.com | grep -q "workos" && echo "PASS" || echo "FAIL"

# 3. Dashboard shows "Verified" status
# (Manual check - no API endpoint for this)

# 4. Custom domain works in production
# (Trigger auth flow and check domain in browser)
```

## Error Recovery

### "Domain verification failed" (Dashboard)

**Root causes:**

1. **CNAME records not created** → Check DNS provider dashboard
2. **CNAME values don't match dashboard exactly** → Copy/paste values again
3. **DNS not yet propagated** → Wait, WorkOS retries for 72 hours
4. **Cloudflare proxy enabled** (AuthKit only) → Disable proxy mode

**Fix pattern:**

```bash
# 1. Verify records exist
dig +short CNAME <your-host>

# 2. Compare output to dashboard target
# If mismatch: delete and recreate DNS records

# 3. If match but still failing: wait for propagation
# WorkOS will auto-verify when DNS resolves
```

### "CNAME already exists" (DNS provider)

**Cause:** Subdomain has existing record (often an A record).

**Fix:**

1. Check existing records: `dig ANY your-subdomain.example.com`
2. Delete conflicting A/AAAA/CNAME records
3. Add WorkOS CNAME records
4. If you need that subdomain for something else, choose a different subdomain for WorkOS

### Emails still coming from workos.dev (after verification)

**Causes:**

1. **Email domain not verified yet** → Check dashboard status
2. **Wrong environment** → Confirm production API key in use
3. **DNS propagation incomplete** → Check with `dig` command

**Not a caching issue** — WorkOS checks DNS on every email send.

### AuthKit shows "invalid domain" error

**Causes:**

1. **Cloudflare proxy enabled** → Must be DNS-only mode
2. **CNAME pointing to wrong target** → Must match dashboard exactly
3. **Domain not verified in dashboard** → Complete verification first

**Fix priority:**

1. Check Cloudflare proxy setting FIRST (most common)
2. Verify CNAME target with `dig`
3. Check dashboard verification status

### DNS changes not taking effect after 24 hours

**Rare causes:**

1. **TTL on old record too high** → Wait for TTL expiry (check old record's TTL value)
2. **DNSSEC enabled with stale signatures** → Update DNSSEC records or temporarily disable
3. **DNS provider API lag** → Try creating records via provider's web UI instead of API

**Nuclear option:** If stuck after 72 hours, delete domain from WorkOS dashboard and start over with fresh CNAME records.

### Certificate warnings when visiting AuthKit domain

**Causes:**

1. **Domain not verified yet** → Complete verification first
2. **Very recent verification** → Certificate provisioning can take 5-10 minutes after DNS verification
3. **Cloudflare proxy interference** → Ensure DNS-only mode

**Expected behavior:** WorkOS auto-provisions SSL certificates AFTER DNS verification succeeds. No manual certificate upload needed.

## Related Skills

- workos-authkit-nextjs — For implementing AuthKit with custom domain
- workos-authkit-react — For implementing AuthKit with custom domain
