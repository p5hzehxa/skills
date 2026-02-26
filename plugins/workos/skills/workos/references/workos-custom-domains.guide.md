<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

The fetched docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Domain Purpose Decision Tree

```
What will the custom domain host?
  |
  +-- Email (Magic Auth, password resets, invitations)
  |     → Configure email domain with DNS records
  |     → Affects: outbound email sender identity
  |
  +-- AuthKit (login UI, OAuth callbacks)
  |     → Configure AuthKit domain with DNS + SSL
  |     → Affects: WORKOS_REDIRECT_URI, cookie domains
  |     → CRITICAL: Update all callback URLs in production code
  |
  +-- Auth API (hosted login for non-AuthKit)
  |     → Configure Auth API domain with DNS
  |     → Affects: authorization/token endpoints
  |
  +-- Admin Portal (organization self-service)
        → Configure Admin Portal domain with DNS
        → Affects: portal links sent to end users
```

**Multiple domains?** Repeat DNS setup for each. Each domain type is independent.

## Step 3: DNS Configuration Pattern

All custom domain types follow this pattern:

1. **WorkOS Dashboard** (production environment only)
   - Navigate to Domains section
   - Add domain → WorkOS generates DNS records

2. **DNS Provider**
   - Add TXT/CNAME records exactly as shown in Dashboard
   - Records validate domain ownership + route traffic

3. **Verification**
   - WorkOS polls DNS (can take 24-48 hours)
   - Dashboard shows "Verified" status when complete

**DO NOT proceed to Step 4 until Dashboard shows "Verified".**

Check fetched docs for exact DNS record formats — they vary by domain type.

## Step 4: Code Updates (AuthKit Domains ONLY)

If configuring an AuthKit custom domain, update these in production code:

```javascript
// Before: WorkOS-hosted domain
const authUrl = workos.userManagement.getAuthorizationUrl({
  redirectUri: 'https://id.workos.com/auth/callback',
  // ...
});

// After: Custom domain
const authUrl = workos.userManagement.getAuthorizationUrl({
  redirectUri: 'https://auth.yourapp.com/auth/callback',
  // ...
});
```

**Also update:**

- Environment variable: `WORKOS_REDIRECT_URI` or equivalent
- OAuth app registration in WorkOS Dashboard (if using OAuth)
- Any hardcoded callback URLs in frontend code

**Email/Admin Portal domains:** No code changes required. WorkOS updates these backend-only.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify domain shows "Verified" in Dashboard
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  https://api.workos.com/domains | grep -q '"verified":true' && echo "✓ verified" || echo "✗ not verified"

# 2. (AuthKit only) Confirm callback URL updated in code
grep -r "auth.yourapp.com" src/ || echo "FAIL: Custom domain not in codebase"

# 3. (Email only) Send test email via SDK
# Use SDK method for sending test email — check fetched docs for exact method

# 4. (AuthKit only) Test login flow end-to-end
# Navigate to custom domain login URL — confirm no SSL errors or redirects to workos.com
```

**For production launch:** Test from a fresh browser (no cached sessions) to catch cookie domain issues.

## Error Recovery

### "Domain verification pending" (24+ hours)

**Root cause:** DNS propagation delay or incorrect records.

1. Check DNS records propagated: `dig TXT yourdomain.com` (should show WorkOS TXT record)
2. Compare `dig` output to Dashboard records exactly — case-sensitive, no trailing dots
3. If records match but still pending: DNS provider may have long TTL (wait or lower TTL to 300s)

### "SSL certificate error" on AuthKit domain

**Root cause:** Custom domain SSL provisioning incomplete.

- WorkOS auto-provisions SSL after DNS verification
- Check Dashboard shows "SSL Active" status (separate from "Verified")
- If stuck: Contact WorkOS support — manual cert validation may be required

### Emails still sent from workos.dev

**Root cause:** Using staging environment or domain not verified.

1. Confirm production environment selected in Dashboard (toggle top-right)
2. Confirm email domain shows "Verified" status
3. Staging environments ALWAYS use workos.dev — cannot be customized

### AuthKit login redirects to workos.com

**Root cause:** Callback URL mismatch or cookie domain issue.

1. Check browser network tab: callback URL in authorization request should be custom domain
2. If using session cookies: verify cookie domain set to `.yourapp.com` (with leading dot for subdomains)
3. Check WorkOS Dashboard → Redirect URIs include custom domain callback

### "Invalid redirect_uri" error after custom domain setup

**Root cause:** OAuth app registration not updated.

- Update Redirect URIs in WorkOS Dashboard → Configuration → OAuth
- Add custom domain callback alongside existing URIs during migration
- Remove old workos.com callback only after confirming custom domain works

## Related Skills

- workos-authkit-nextjs — AuthKit + Next.js integration (callback setup)
- workos-authkit-react — AuthKit + React integration (callback setup)
