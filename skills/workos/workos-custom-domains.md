---
name: workos-custom-domains
description: Configure custom domains for WorkOS-hosted pages.
---

<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to replace WorkOS-branded URLs (auth.workos.com, id.workos.com) with your own domain in authentication flows, emails, or Admin Portal links. This provides brand consistency for end users interacting with SSO login pages, magic link emails, or self-service organization management interfaces.

## Key Vocabulary

- **Custom Domain** — your domain (e.g., `auth.example.com`) that replaces WorkOS URLs
- **CNAME record** — DNS configuration pointing your domain to WorkOS infrastructure
- **SSL/TLS certificates** — automatically provisioned by WorkOS after DNS verification
- **Email domain** — custom sender domain for magic link emails (e.g., `@example.com`)
- **DKIM/SPF records** — DNS records for email authentication
- **AuthKit redirect URLs** — callback URLs using your custom domain
- **Admin Portal URL** — branded link for organization self-service portals
- **Environment ID `env_`** — WorkOS environment where custom domains are configured

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-custom-domains.guide.md`

## Related Skills

- workos-authkit-base
- workos-admin-portal
