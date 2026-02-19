---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to white-label WorkOS authentication flows (AuthKit, Auth API) or transactional emails under your own domain. This allows end users to interact with authentication URLs and receive emails from your domain instead of `workos.com`, maintaining brand consistency.

## Documentation

- https://workos.com/docs/custom-domains/index
- https://workos.com/docs/custom-domains/email
- https://workos.com/docs/custom-domains/authkit
- https://workos.com/docs/custom-domains/auth-api
- https://workos.com/docs/custom-domains/admin-portal

## Key Vocabulary

- **Custom Domain** — your branded domain (e.g., `auth.yourapp.com`) configured for WorkOS services
- **Email Custom Domain** — domain used for transactional emails (e.g., `noreply@yourapp.com`)
- **AuthKit Custom Domain** — domain hosting AuthKit UI flows
- **Auth API Custom Domain** — domain for headless Auth API endpoints
- **Admin Portal Custom Domain** — domain for embedded Admin Portal
- **CNAME record target** — `custom-domains.workos.com` (for AuthKit/Auth API/Admin Portal)
- **MX record target** — `custom-domains-email.workos.com` (for email domain)
- **Domain verification status** — `pending`, `verified`, or `failed` states

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-custom-domains.guide.md`
