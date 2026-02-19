<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Check

- Confirm `WORKOS_API_KEY` exists (starts with `sk_`)
- Confirm production environment is selected in WorkOS Dashboard
- Confirm you have domain ownership or DNS access

**Critical:** Custom domains are production-only. Staging always uses WorkOS-managed domains (`workos.dev` for email, `*.authkit.app` for AuthKit).

### Domain Decision Tree

```
What do you need to customize?
  |
  +-- Email sending (Magic Auth, password resets, invitations)
  |     --> Email Domain (adds 3 CNAME records)
  |
  +-- AuthKit UI/OAuth flows
  |     --> AuthKit Domain (adds 1 CNAME record)
  |           |
  |           +-- DNS provider is Cloudflare?
  |                 --> MUST set CNAME to DNS-only (not proxied)
  |
  +-- Admin Portal UI
        --> Check fetched docs for Admin Portal custom domain setup
```

## Step 3: Email Domain Configuration

### When to Use

You need an email domain if your app uses:
- Magic Auth (passwordless email login)
- Email verification
- Password reset flows
- User invitations

### Dashboard Setup

1. Navigate to Dashboard → Production Environment → Domains section
2. Click "Add Domain"
3. Enter your sending domain (e.g., `auth.example.com` or `example.com`)
4. Dashboard displays 3 CNAME records

### DNS Configuration

Add ALL 3 CNAME records to your DNS provider:

```
Type    Name                Value (from dashboard)
CNAME   <random-prefix>     <workos-target>
CNAME   <random-prefix>     <workos-target>
CNAME   <random-prefix>     <workos-target>
```

**Critical:** Do NOT remove these records after verification. WorkOS needs them permanently to send email on your behalf.

### Verification Timing

- Click "Verify now" in dashboard after adding DNS records
- Verification retries automatically for 72 hours if initial attempt fails
- DNS propagation can take minutes to hours depending on provider

**Trap:** Verification fails silently if records are misconfigured. Check your DNS provider's interface for typos in record values.

## Step 4: AuthKit Domain Configuration

### When to Use

You need an AuthKit domain if:
- You want branded URLs for login/signup flows
- OAuth callbacks must match your domain
- You're migrating from an existing auth system with branded URLs

### Dashboard Setup

1. Navigate to Dashboard → Production Environment → Domains section
2. Click "Configure AuthKit domain"
3. Enter your AuthKit subdomain (e.g., `auth.example.com`)
4. Dashboard displays 1 CNAME record

### DNS Configuration

Add the CNAME record to your DNS provider:

```
Type    Name                Value (from dashboard)
CNAME   auth.example.com    <workos-target>
```

### Cloudflare-Specific Trap (CRITICAL)

If your DNS provider is Cloudflare:
1. Create the CNAME record
2. Click the orange cloud icon to disable proxy (turn gray)
3. Confirm status shows "DNS only"

**Why:** WorkOS uses Cloudflare internally. Cloudflare blocks proxying across accounts. A proxied CNAME will fail verification with no clear error message.

**Verification command:**

```bash
# Check CNAME resolves correctly
dig auth.example.com CNAME +short
# Should show WorkOS target, not Cloudflare proxy
```

### Redirect URI Updates

After AuthKit domain verification, update your OAuth redirect URIs:

**Old:** `https://youthful-ginger-43.authkit.app/callback`
**New:** `https://auth.example.com/callback`

Update these locations:
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` (or equivalent env var)
- WorkOS Dashboard → Redirect URIs
- Any hardcoded redirect logic in your app

**Trap:** Mismatched redirect URIs cause "invalid_request" OAuth errors. Verify both dashboard config AND environment variables match your custom domain.

## Step 5: Admin Portal Domain Configuration

**Check fetched Admin Portal docs** for setup instructions. The process mirrors AuthKit domain setup but may have different CNAME requirements.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm setup:

```bash
# 1. Email domain DNS (replace with your records)
dig <your-cname-name> CNAME +short
# Should return WorkOS target, not NXDOMAIN

# 2. AuthKit domain DNS
dig auth.example.com CNAME +short
# Should return WorkOS target (NOT Cloudflare IPs if using CF)

# 3. AuthKit domain HTTPS works
curl -I https://auth.example.com
# Should return 200 OK or 3xx redirect

# 4. Dashboard verification status
# Check WorkOS Dashboard → Domains → Status column
# Should show "Verified" not "Pending"
```

**If dashboard shows "Pending" after 1 hour:**
- Re-check DNS records for typos
- Confirm records are added to the correct zone
- For Cloudflare: verify cloud icon is gray (DNS-only)

## Error Recovery

### "CNAME record not found" during verification

**Root cause:** DNS propagation delay or misconfigured record.

**Fix:**
1. Verify record exists in DNS provider's interface
2. Wait 10-15 minutes and retry verification
3. Use `dig <record-name> CNAME +short` to confirm propagation
4. Check you added records to the correct DNS zone (not a subdomain's zone)

### AuthKit domain verification fails (Cloudflare)

**Root cause:** CNAME is proxied instead of DNS-only.

**Fix:**
1. Log into Cloudflare dashboard
2. Find the CNAME record
3. Click the orange cloud icon → turns gray
4. Retry verification in WorkOS dashboard

**Verification command:**
```bash
dig auth.example.com +short
# If returns IP addresses → proxied (wrong)
# If returns *.workos.com → DNS-only (correct)
```

### Email domain verified but emails not arriving

**Root cause:** Email domain CNAME records were removed after verification.

**Fix:**
1. Re-add all 3 CNAME records from dashboard
2. Wait for DNS propagation (check with `dig`)
3. Email sending will resume automatically

**Critical:** CNAME records are NOT one-time setup. They must remain in place permanently.

### OAuth "invalid_request" after adding custom AuthKit domain

**Root cause:** Redirect URI mismatch between dashboard config and environment variables.

**Fix:**
1. Check environment variable points to custom domain:
   ```bash
   grep REDIRECT_URI .env.local
   # Should show https://auth.example.com/callback
   ```
2. Check WorkOS Dashboard → Redirect URIs includes custom domain URL
3. Restart development server after changing env vars
4. For production: redeploy with updated env vars

### "DNS_PROBE_FINISHED_NXDOMAIN" when accessing custom domain

**Root cause:** CNAME record not added or not propagated.

**Fix:**
1. Confirm CNAME exists in DNS provider
2. Check propagation: `dig auth.example.com CNAME +short`
3. If no result after 30+ minutes, check DNS zone is correct
4. For subdomain custom domains (e.g., auth.example.com), confirm parent zone (example.com) exists

## Related Skills

- workos-authkit-nextjs — Uses redirect URIs that must match custom domain
- workos-authkit-react — Uses redirect URIs that must match custom domain
- workos-authkit-vanilla-js — Uses redirect URIs that must match custom domain
