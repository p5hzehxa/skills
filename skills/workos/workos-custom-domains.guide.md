<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched docs are the source of truth. If this guide conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

Confirm you're working in **production environment**. Custom domains are production-only:

```bash
# Check dashboard environment selector - must show "Production"
# Staging environment ALWAYS uses WorkOS domains (*.workos.dev, *.authkit.app)
```

### Account Status

- WorkOS account with production access
- Custom domains enabled (paid feature - see pricing page)
- Dashboard access at dashboard.workos.com

## Step 3: Domain Selection (Decision Tree)

```
What needs custom branding?
  |
  +-- Sending emails (Magic Auth, password resets, invites)
  |     --> Email Domain (no-reply@your-domain.com)
  |
  +-- AuthKit UI (login/signup pages)
  |     --> AuthKit Domain (auth.your-domain.com)
  |
  +-- Admin Portal (for customer SSO admins)
  |     --> Admin Portal Domain (admin.your-domain.com)
  |
  +-- Multiple services
        --> Configure each separately (independent DNS setup)
```

**Critical:** Each service requires separate DNS configuration. You cannot reuse the same domain for multiple services without subdomain separation.

## Step 4: Email Domain Setup

### DNS Provider Decision

```
DNS provider?
  |
  +-- Cloudflare --> CNAME must be DNS-only (NOT proxied)
  |
  +-- Other --> Standard CNAME setup
```

### Configuration Path

1. Dashboard → Domains section (production environment selected)
2. Click "Add Domain"
3. Enter domain: `your-domain.com` (NOT `no-reply@your-domain.com`)

### DNS Records (BLOCKING)

Dashboard displays 3 CNAME records. Create ALL three with your DNS provider:

```
# Pattern (exact values shown in dashboard):
Host: [workos-provided-value]
Points to: [workos-provided-target]

# Common trap: Using "no-reply" as host
# WRONG: no-reply.your-domain.com
# RIGHT: Values exactly as shown in dashboard
```

### Verification

Click "Verify now" after DNS propagation (15min - 24hrs typical):

```bash
# Check DNS propagation before verification
dig +short [cname-host-from-dashboard]

# Should return WorkOS target domain
# Empty result = DNS not propagated yet
```

**Recovery window:** WorkOS retries verification for 72 hours. If verification fails:

1. Check CNAME records match dashboard exactly (copy-paste, don't retype)
2. Check TTL hasn't expired cached old records
3. Wait and retry - propagation can take 24+ hours

### Post-Verification

- Emails sent from `no-reply@your-domain.com`
- **CRITICAL:** Do NOT remove CNAME records after verification - email delivery stops immediately

## Step 5: AuthKit Domain Setup

### Configuration Path

1. Dashboard → Domains section (production environment selected)
2. Click "Configure AuthKit domain"
3. Enter subdomain: `auth.your-domain.com`

**Naming trap:** Use subdomain (auth.X) NOT root domain (X.com). AuthKit requires TLS cert issuance.

### DNS Records (BLOCKING)

Dashboard displays 1 CNAME record:

```
Host: auth (or full: auth.your-domain.com)
Points to: [workos-provided-target]
```

**Cloudflare users (CRITICAL):**
- CNAME must be "DNS only" (gray cloud icon)
- Do NOT enable proxy (orange cloud icon)
- WorkOS uses Cloudflare backend - double-proxying forbidden

Verification command:

```bash
# Check CNAME setup
dig +short auth.your-domain.com

# Should return WorkOS target (NOT Cloudflare proxy IP)
```

### Application Integration

After verification, update AuthKit configuration:

```
Redirect URI environment variable?
  |
  +-- Was: https://[random-phrase].authkit.app/callback
  |
  +-- Now: https://auth.your-domain.com/callback
```

Update in:
- Environment variables (`WORKOS_REDIRECT_URI`)
- WorkOS Dashboard → Redirect URI allowlist
- Application auth config (check related AuthKit skills for specifics)

**Verification after DNS propagation:**

```bash
# Test AuthKit domain resolves
curl -I https://auth.your-domain.com

# Should return 200 or redirect (NOT DNS error)
```

## Step 6: Admin Portal Domain Setup

Check fetched docs (`/custom-domains/admin-portal`) for Admin Portal configuration. Pattern matches AuthKit domain setup:

- Subdomain recommended (e.g., `admin.your-domain.com`)
- Cloudflare DNS-only requirement applies
- Update Admin Portal links in your application after verification

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify environment
# Manual check: Dashboard shows "Production" environment

# 2. Email domain DNS (if configured)
dig +short [host-from-dashboard] | grep -q "workos" && echo "PASS" || echo "FAIL"

# 3. AuthKit domain DNS (if configured)
dig +short auth.your-domain.com | grep -v "$(dig +short your-domain.com)" && echo "PASS" || echo "FAIL"

# 4. AuthKit endpoint responds (after propagation)
curl -sI https://auth.your-domain.com | head -n1 | grep -q "HTTP" && echo "PASS" || echo "FAIL"

# 5. Application builds with updated config
# Check your build command succeeds
```

## Error Recovery

### "Domain verification failed"

**Root cause:** DNS records don't match dashboard exactly.

Fix:
1. Copy CNAME values from dashboard (select + copy, don't retype)
2. Check for trailing dots in DNS provider (some require, some forbid)
3. Verify TTL hasn't cached old records: `dig +trace [host]`
4. Wait 72 hours - WorkOS retries automatically

### "Email delivery stopped after verification"

**Root cause:** CNAME records removed post-verification.

Fix:
1. Re-add CNAME records from dashboard
2. Wait for DNS propagation
3. Email delivery resumes automatically

### "AuthKit domain shows Cloudflare error page"

**Root cause:** CNAME is proxied (orange cloud) instead of DNS-only (gray cloud).

Fix:
1. Cloudflare dashboard → DNS settings
2. Click orange cloud on AuthKit CNAME to disable proxy
3. Wait 5-10 minutes for propagation
4. Verify: `dig auth.your-domain.com` should show WorkOS target, not Cloudflare IP

### "Redirect URI mismatch after AuthKit domain change"

**Root cause:** Application still uses old `*.authkit.app` redirect URI.

Fix:
1. Update `WORKOS_REDIRECT_URI` to new custom domain
2. Dashboard → Redirect URIs → Add custom domain callback
3. Restart application to pick up new env var
4. Test auth flow end-to-end

### "Admin Portal links broken after domain change"

**Root cause:** Application hardcodes old Admin Portal URLs.

Fix:
1. Search codebase for `*.workos.com/admin-portal` references
2. Replace with custom Admin Portal domain
3. Update any stored Admin Portal invite links

### "DNS propagation taking >24 hours"

Not an error - normal for some DNS providers. WorkOS retries for 72 hours.

Workaround to test before global propagation:
```bash
# Override DNS resolution locally (macOS/Linux)
echo "[workos-target-ip] auth.your-domain.com" | sudo tee -a /etc/hosts

# Test application
# Remember to remove line from /etc/hosts after testing
```

## Related Skills

- workos-authkit-nextjs - For updating AuthKit redirect URIs
- workos-authkit-react - For updating AuthKit redirect URIs
