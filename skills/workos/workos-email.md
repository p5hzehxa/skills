---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this skill when you need to send transactional emails (password resets, verification codes, notifications) through WorkOS's managed email infrastructure. This skill covers API-based email sending, template management, and delivery tracking. Choose this over direct SMTP when you want WorkOS-managed deliverability, bounce handling, and compliance.

## Documentation

- https://workos.com/docs/email

## Key Vocabulary

- **Email** `email_` — the email message object
- **Template** `template_` — reusable email template with variables
- **Environment** `env_` — isolated sending context (dev/staging/prod)
- **`WORKOS_API_KEY`** — authentication credential for API requests
- **Recipient** — destination email address with optional metadata
- **Delivery Status** — tracking state (sent, delivered, bounced, failed)
- **Send Event** — webhook notification for email lifecycle changes

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-email.guide.md`
