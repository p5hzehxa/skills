<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this skill when you need to send transactional emails (password resets, notifications, OTPs) through WorkOS's managed SMTP infrastructure. This offloads email delivery, bounce handling, and reputation management to WorkOS instead of managing your own mail server or third-party provider.

## Key Vocabulary

- **Email Message** `email_msg_` — a sent email with delivery tracking
- **Email Template** `email_tpl_` — reusable HTML/text template with variable substitution
- **Email Event** — delivery status notifications (`email.sent`, `email.delivered`, `email.bounced`, `email.complained`)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-email.guide.md`
