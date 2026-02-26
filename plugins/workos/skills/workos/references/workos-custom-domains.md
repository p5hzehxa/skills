<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to white-label WorkOS-hosted authentication flows (AuthKit) under your own domain instead of the default `auth.workos.com`. This skill enables customers to see `auth.yourcompany.com` in their browser during login, improving brand consistency and user trust.

## Key Vocabulary

- **Custom Domain** `custom_domain_` — a verified DNS hostname that replaces `auth.workos.com`
- **SSL Certificate** `ssl_certificate_` — TLS certificate issued for the custom domain
- **Domain Verification** — DNS CNAME record proving domain ownership

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-custom-domains.guide.md`
