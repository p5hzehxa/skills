---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this skill when you need to send transactional emails (e.g., password resets, account notifications) through WorkOS's managed infrastructure. This is appropriate when you want reliable delivery, webhook-based status tracking, and centralized email management without configuring your own SMTP provider.

## Documentation

- https://workos.com/docs/email

## Key Vocabulary

- **Email** `email_` — represents a sent email message
- **Email Template** `email_template_` — reusable email content with variable substitution
- **Webhook Event** `email.sent`, `email.delivered`, `email.bounced`, `email.opened` — delivery status notifications

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-email.guide.md`
