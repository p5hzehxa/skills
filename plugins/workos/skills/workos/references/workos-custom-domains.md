<!-- refined:sha256:65da0f370d28 -->

# WorkOS Custom Domains

## When to Use

Use this skill when you need to white-label WorkOS authentication flows (AuthKit UI, email links, magic links) under your own domain instead of `id.workos.com`. This improves brand consistency and user trust by keeping users on your domain throughout the auth flow.

## Key Vocabulary

- **Custom Domain** `domain_` — A verified domain configuration that replaces `id.workos.com` in AuthKit URLs
- **Domain Verification Record** — DNS TXT record proving domain ownership
- **SSL Certificate** — Auto-provisioned by WorkOS after DNS verification completes

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-custom-domains.guide.md`
