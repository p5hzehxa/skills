<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

Confirm you're in the **Production** environment:

```bash
# Check current environment in code or dashboard
echo $WORKOS_ENVIRONMENT  # Should be "production" or unset (defaults to production)
```

**CRITICAL:** Custom domains are a production-only feature. Staging environments always use WorkOS default domains (`workos.dev` for email, `*.authkit.app` for AuthKit).

### Prerequisites

- WorkOS account with production environment
- DNS provider access with ability to create CNAME records
- Domain you own and control

## Step 3: Domain Type Decision Tree

Custom domains apply to THREE different services. Pick your path:

```
What are you customizing?
  |
  +-- Email (Magic Auth, password resets, invites)
  |     └─> Go to Step 4: Email Domain
  |
  +-- AuthKit (hosted UI)
  |     └─> Go to Step 5: AuthKit Domain
  |
  +-- Admin Portal
        └─> Check fetched docs for Admin Portal custom domain setup
```

**Note:** You can configure multiple domain types. Each requires separate DNS records.

## Step 4: Email Domain Setup

### Configuration

1. In WorkOS Dashboard (production environment): Navigate to **Domains** section
2. Click **Add Domain**
3. Enter domain for email (e.g., `yourdomain.com`)

### DNS Records (CRITICAL)

You will receive **3 CNAME records** to create with your DNS provider.

**Pattern recognition:**

- All records point to WorkOS infrastructure
- Records enable DKIM signing and mail delivery tracking
- **Do NOT delete these records after verification** — they're required for ongoing delivery

### Verification

WorkOS will attempt verification immediately, then retry for 72 hours if DNS hasn't propagated.

**Manual verification command:**

```bash
# Check if CNAME records are live (replace with your actual records)
dig CNAME dkim1._domainkey.yourdomain.com
dig CNAME dkim2._domainkey.yourdomain.com
dig CNAME bounce.yourdomain.com
```

All should return CNAME records pointing to WorkOS infrastructure.

### Expected Outcome

Once verified, emails send from: `no-reply@yourdomain.com`

**Trap warning:** If you remove CNAME records after verification, email delivery will break. Keep records in place permanently.

## Step 5: AuthKit Domain Setup

### Default Behavior

- Staging: Always uses `{random-phrase}.authkit.app`
- Production (unconfigured): Uses `{random-phrase}.authkit.app`
- Production (custom): Uses your domain

### Configuration

1. In WorkOS Dashboard (production environment): Navigate to **Domains** section
2. Click **Configure AuthKit domain**
3. Enter subdomain (e.g., `auth.yourdomain.com`)

### DNS Records (CRITICAL)

You will receive **1 CNAME record** to create.

**Cloudflare users (TRAP WARNING):**

If your DNS provider is Cloudflare, set the CNAME to **DNS-only** (gray cloud icon), NOT proxied (orange cloud).

Why: WorkOS uses Cloudflare for custom domain management. Cloudflare prohibits double-proxying across accounts.

**Verification command:**

```bash
# Check CNAME is live and not proxied
dig CNAME auth.yourdomain.com

# Should return CNAME to WorkOS infrastructure
# Should NOT return Cloudflare proxy IPs (104.x.x.x range)
```

### Expected Outcome

AuthKit UI loads at: `https://auth.yourdomain.com`

## Step 6: Update Application Configuration

### Redirect URIs

After custom domain verification, update redirect URIs in your application:

**Before:**

```
WORKOS_REDIRECT_URI=https://youthful-ginger-43.authkit.app/callback
```

**After:**

```
WORKOS_REDIRECT_URI=https://auth.yourdomain.com/callback
```

**CRITICAL:** Also update the redirect URI in WorkOS Dashboard under your application's configuration.

### Email Template References

If you reference AuthKit URLs in custom email templates or application code, update them to use custom domain.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify environment is production
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/user_management/organizations | jq -r '.metadata.environment'
# Should NOT be "staging"

# 2. Check DNS records are live (email example)
dig CNAME dkim1._domainkey.yourdomain.com +short
# Should return CNAME target, not empty

# 3. Check AuthKit domain resolves (if configured)
dig CNAME auth.yourdomain.com +short
# Should return CNAME target, not empty

# 4. Verify AuthKit loads at custom domain (if configured)
curl -I https://auth.yourdomain.com
# Should return 200 OK, not connection refused

# 5. Check Dashboard shows "Verified" status
# Manual check in WorkOS Dashboard → Domains section
```

## Error Recovery

### "Domain verification failed"

**Root cause:** DNS records not propagated or misconfigured.

**Fix:**

1. Verify CNAME records exist with `dig` commands above
2. Check for typos in CNAME record values
3. Wait 10-60 minutes for DNS propagation
4. Click "Verify now" again in Dashboard

### "CNAME already exists" error

**Root cause:** Domain/subdomain already has conflicting DNS records.

**Fix:**

1. Check existing DNS records for the domain: `dig yourdomain.com`
2. Remove conflicting A or CNAME records
3. Custom domains require exclusive control of the subdomain

### AuthKit loads but shows WorkOS branding

**Root cause:** Custom domain configured but application still using default URL.

**Fix:**

1. Update `WORKOS_REDIRECT_URI` environment variable
2. Update redirect URI in WorkOS Dashboard application settings
3. Restart application to load new environment variables
4. Clear browser cache/cookies

### Emails still coming from workos.dev

**Root causes:**

1. Environment is staging (custom email domains not available)
2. Domain verification incomplete
3. DNS records removed after verification

**Fix:**

1. Confirm production environment: check Dashboard environment selector
2. Check Dashboard → Domains → Email domain status is "Verified"
3. Re-add DNS records if removed: `dig CNAME` commands should return records

### Cloudflare proxying breaks AuthKit domain

**Root cause:** Cloudflare CNAME is proxied (orange cloud), not DNS-only (gray cloud).

**Fix:**

1. Log into Cloudflare dashboard
2. Find the CNAME record for your AuthKit domain
3. Click the orange cloud icon to disable proxy (turn it gray)
4. Wait 5-10 minutes for Cloudflare to update
5. Verify with: `dig auth.yourdomain.com` should NOT return Cloudflare IPs

### "This site can't be reached" for custom AuthKit domain

**Root causes:**

1. CNAME record missing or incorrect
2. DNS propagation incomplete
3. Cloudflare proxying enabled (if using Cloudflare)

**Fix:**

1. Verify CNAME exists: `dig CNAME auth.yourdomain.com +short`
2. Compare CNAME target to value shown in Dashboard
3. If using Cloudflare, disable proxy (see above)
4. Wait 10-60 minutes, try again

## Related Skills

For AuthKit integration with custom domains:

- workos-authkit-nextjs
- workos-authkit-react
- workos-authkit-base
