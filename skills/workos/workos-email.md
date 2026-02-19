---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## When to Use

Use this when you need to send transactional emails (password resets, magic links, verification codes, team invitations) through WorkOS infrastructure instead of managing your own email provider. WorkOS handles email delivery, retry logic, bounce tracking, and deliverability optimization. This skill covers both the Emails API (programmatic sending) and the Magic Auth email flow (passwordless authentication).

## Documentation

- https://workos.com/docs/email

## Key Concepts

**Core Email Types:**
- **Transactional emails** — system-generated messages triggered by user actions (verification, password reset, notifications)
- **Magic Auth emails** — passwordless authentication flow where WorkOS sends a magic link to the user
- **Custom emails** — branded messages using your own templates via the Emails API

**API Structure:**
- **Emails API** — send custom transactional emails programmatically
  - ID prefix: `email_` for email objects
  - Environment variable: `WORKOS_API_KEY` for authentication
- **Magic Auth flow** — WorkOS-managed email sending for passwordless login
  - Uses `POST /user_management/magic_auth/send` endpoint
  - Returns a verification token that expires after a configurable TTL

**Email Sending Patterns:**
- **Immediate send** — call the API and WorkOS delivers asynchronously
- **Template-based** — define HTML/text templates in the WorkOS Dashboard under "Email Templates"
- **Variable substitution** — pass dynamic data (user name, verification code, etc.) that WorkOS injects into templates

**Dashboard Configuration:**
- Navigate to WorkOS Dashboard → Email Settings to configure:
  - From address and sender name
  - Reply-to address
  - Email templates (HTML and plaintext versions)
  - Magic Auth TTL and redirect URLs

**Integration Decisions:**
- **Use Magic Auth** when implementing passwordless login — WorkOS handles the entire email flow
- **Use Emails API** when you need custom transactional emails with full control over content and timing
- **Template strategy** — create templates in Dashboard for consistent branding, or pass raw HTML via API for dynamic content

**Event Webhooks:**
- Email delivery events follow the pattern: `email.{action}`
- Example events: `email.sent`, `email.delivered`, `email.bounced`, `email.opened`
- Use webhooks to track delivery status and handle bounce notifications

**Verification:**
```bash
# Test email delivery (requires WorkOS CLI or API key)
curl -X POST https://api.workos.com/emails \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","body":"Hello"}'
```

**Common Traps:**
- Magic Auth emails are rate-limited per user — check fetched docs for exact limits before implementing retry logic
- Email templates require both HTML and plaintext versions for deliverability — missing plaintext increases spam score
- From address must be verified in Dashboard before sending — unverified addresses will fail silently

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-email.guide.md`
