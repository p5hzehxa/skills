---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this skill when you need to send transactional emails (password resets, magic links, verification codes) through WorkOS's managed infrastructure. WorkOS handles deliverability, rate limiting, and email provider management, so you don't need to integrate SendGrid/Mailgun directly.

## Key Vocabulary

- **Email `email_`** — the unique identifier for a sent email message
- **`WORKOS_API_KEY`** — server-side authentication token for Email API
- **Email Template** — reusable HTML/text content managed in WorkOS Dashboard
- **Dashboard path** — Email → Templates → Create Template
- **Event types** — `email.sent`, `email.delivered`, `email.bounced`, `email.opened`
- **Sender domain** — custom domain configured for "From" addresses (Dashboard → Email → Domains)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-email.guide.md`

## Related Skills

- workos-authkit-base (for magic link integration)
- workos-user-management (for password reset flows)
