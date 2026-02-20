<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this skill when you need to send transactional emails (password resets, magic links, verification codes) through WorkOS's managed email infrastructure instead of maintaining your own SMTP service or third-party provider. WorkOS handles deliverability, rate limiting, and template rendering.

## Key Vocabulary

- **Email `email_`** — A sent email record with delivery status
- **Email Template `email_template_`** — Reusable HTML/text template with variable substitution
- **Email Event** — Webhook notification for delivery status (`email.sent`, `email.delivered`, `email.bounced`, `email.opened`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-email.guide.md`
