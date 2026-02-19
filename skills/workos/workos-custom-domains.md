---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to white-label WorkOS authentication flows and emails with your own domain instead of displaying WorkOS branding. Custom domains allow you to serve AuthKit login pages, API endpoints, and transactional emails from your domain (e.g., `auth.yourdomain.com`), improving trust and brand consistency for end users.

## Documentation

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

## Key Concepts

**Domain Types:**
- **AuthKit Custom Domain** — serves login/signup UI at your subdomain (e.g., `auth.yourdomain.com`)
- **Auth API Custom Domain** — serves authentication API endpoints at your subdomain
- **Email Custom Domain** — sends magic link and verification emails from `@yourdomain.com`

**DNS Configuration:**
- CNAME records point your subdomain to WorkOS infrastructure
- TXT records verify domain ownership
- MX records (email only) route bounce/complaint notifications
- SSL certificates are automatically provisioned by WorkOS after DNS verification

**Dashboard Setup:**
- Navigate to Settings → Custom Domains in WorkOS Dashboard
- Add domain → WorkOS provides DNS records → verify propagation → domain becomes active
- Separate configurations for AuthKit, Auth API, and Email (you can configure one, two, or all three)

**Environment Variables:**
- `WORKOS_REDIRECT_URI` must match your custom domain when configured (e.g., `https://auth.yourdomain.com/callback`)
- `WORKOS_API_HOSTNAME` (optional) — override API base URL when using Auth API custom domain

**Key Decisions:**
- Use AuthKit custom domain if end users see login UI (most visible branding impact)
- Use Email custom domain if magic links or email verification are core to your flow (improves deliverability and trust)
- Use Auth API custom domain if you're making direct API calls and want to avoid `api.workos.com` in network logs (less common, mainly for compliance/audit requirements)

**Common Trap:**
- DNS propagation can take 24-48 hours — do NOT configure custom domains in production immediately before launch. Set them up in staging first and allow time for verification.

**Verification Command:**
```bash
# Check DNS propagation for CNAME record
dig +short CNAME auth.yourdomain.com
# Expected output: workos-provided CNAME target

# Check TXT record for domain ownership
dig +short TXT _workos.yourdomain.com
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-custom-domains.guide.md`
