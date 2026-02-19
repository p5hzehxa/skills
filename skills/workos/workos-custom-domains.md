---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to white-label WorkOS authentication and email services under your own domain instead of `workos.com`. This allows your users to interact with login pages, magic links, and admin portals that appear to be hosted on your infrastructure.

## Documentation

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/admin-portal

## Key Vocabulary

- **Custom Domain** — your branded domain (e.g., `auth.yourapp.com`) that proxies WorkOS services
- **Email Custom Domain** — domain for sending magic link emails (verified via DNS records)
- **AuthKit Custom Domain** — domain for hosting OAuth/SAML login flows
- **Auth API Custom Domain** — domain for API endpoints (`/user_management/*`, `/sso/*`)
- **Admin Portal Custom Domain** — domain for the organization setup UI
- **DNS Verification** — TXT record validation required before activation
- **SSL Certificate** — automatically provisioned by WorkOS after DNS validation
- **CNAME Record** — DNS record type used to point your subdomain to WorkOS infrastructure

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-custom-domains.guide.md`

## Related Skills

- workos-authkit-base — for configuring AuthKit to use custom domains
- workos-magic-link — for email domain configuration
- workos-admin-portal — for custom domain setup in the admin UI
