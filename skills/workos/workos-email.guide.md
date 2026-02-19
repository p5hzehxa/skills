<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Email Delivery Strategy (Decision Tree)

Choose ONE of three delivery methods. This decision affects ALL WorkOS features that send email (invitations, password resets, Magic Auth).

```
Email delivery strategy?
  |
  +-- WorkOS domain (workos-mail.com)
  |   → Zero config, works immediately
  |   → Lower user trust (unfamiliar sender domain)
  |   → Use for: prototypes, internal tools
  |
  +-- Your domain (welcome@yourdomain.com)
  |   → Requires DNS config (CNAME records)
  |   → Higher user trust (recognized sender)
  |   → Use for: production apps with external users
  |   → Go to Step 3
  |
  +-- Self-managed (event-driven)
      → Your email provider handles sending
      → WorkOS emits webhook events only
      → Maximum control, maximum work
      → See workos-webhooks skill for event handling
```

**If using WorkOS domain:** Skip to Step 5 (Deliverability Best Practices).

**If using your domain:** Continue to Step 3.

**If self-managed:** This skill does not apply — implement webhook handlers and your email provider integration separately.

## Step 3: DNS Configuration (Your Domain)

### Locate Configuration UI

Dashboard → Settings → Email Domain

### DNS Records Required

You MUST create THREE CNAME records with your DNS provider:

1. **Domain verification** — Proves ownership
2. **SPF authentication** — Via SendGrid automated security
3. **DKIM authentication** — Via SendGrid automated security

**Critical:** All three records must exist before WorkOS will send from your domain. Dashboard shows verification status.

### Sender Addresses

WorkOS will send from:
- `welcome@yourdomain.com` — User onboarding flows
- `access@yourdomain.com` — Access management flows

## Step 4: Inbox Setup (IMPORTANT)

Create REAL inboxes for both sender addresses:

```bash
# Create these inboxes with your email provider:
welcome@yourdomain.com
access@yourdomain.com
```

**Why:** Email providers verify sender address validity. Nonexistent inboxes trigger spam filters.

**Trap:** Do not use aliases or catch-alls. Create dedicated inboxes.

## Step 5: DMARC Policy (RECOMMENDED)

Add DMARC DNS TXT record to reject unauthorized senders:

```
Record Type: TXT
Name: _dmarc.yourdomain.com
Content: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

**Why:** Google, Yahoo, Apple now require DMARC for bulk senders. Without it, your emails may be rejected entirely.

Check fetched docs for complete DMARC examples and RUA reporting setup.

## Step 6: Deliverability Best Practices (CRITICAL)

These rules apply to ALL delivery methods. Violations will cause deliverability failures:

### Spam Filter Traps

**Never send unsolicited email.** Invitation emails MUST result from explicit user action (user requests access, admin invites colleague). Do NOT bulk-invite users from marketing lists.

**Check naming:** Team names and organization names appear in email bodies. Avoid spam trigger words:
- "Free", "Winner", "Cash", "Loan", "Limited time"
- ALL CAPS names
- Excessive punctuation (!!!, ???)

See [common spam words](https://mailtrap.io/blog/email-spam-words/) — if your org name matches these patterns, email will be flagged.

### Domain Reputation

**If using your domain:**
- Warm up the domain — start with low volume, gradually increase
- Monitor bounce rates — high bounces damage reputation permanently
- Never purchase email lists or scrape contacts

**If using WorkOS domain:**
- WorkOS manages reputation, but your content (org names, team names) still matters
- Unsolicited email on WorkOS domain may result in account suspension

## Verification Checklist

Run these checks to confirm email delivery will work:

```bash
# 1. DNS verification (if using your domain)
dig CNAME _domainkey.yourdomain.com  # Should return SendGrid CNAME
dig TXT _dmarc.yourdomain.com        # Should return DMARC policy

# 2. Dashboard verification
# → Dashboard shows "Verified" status for email domain

# 3. Inbox existence check (manual)
# Send test email to welcome@yourdomain.com — should deliver to inbox, not bounce

# 4. Spam testing (before production)
# Use https://www.mail-tester.com/ — score should be 8+ out of 10
```

**Do not deploy to production** until spam testing scores 8+.

## Error Recovery

### Email not reaching inboxes (ALL USERS)

**Root cause:** Domain reputation issue or missing authentication.

Fix checklist:
1. Verify DMARC record exists: `dig TXT _dmarc.yourdomain.com`
2. Check Google Postmaster Tools — shows reputation score
3. Check Microsoft Sender Support — shows reputation score
4. Verify all DNS records in dashboard show "Verified"
5. Confirm no bulk-sending from marketing lists

If all pass, problem is likely domain warmup — reduce send volume temporarily.

### Email not reaching inboxes (SOME USERS)

**Root cause:** Recipient-specific spam filters or corporate IT policies.

Diagnosis:
- If Gmail/Google Workspace users only → Check [Google Postmaster Tools](https://postmaster.google.com/)
- If Outlook/Microsoft 365 users only → Check [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/)
- If single organization → Contact their IT team (corporate firewall blocking sender domain)

**Enhanced Pre-delivery Scanning:** Google Workspace admins can enable aggressive scanning that delays emails 5-10 minutes. This is normal, not a deliverability failure.

### Emails delayed (5+ minutes)

**Root cause:** Enhanced security scanning at recipient.

- Google: [Enhanced Pre-delivery Message Scanning](https://support.google.com/a/answer/7380368)
- Microsoft: Advanced Threat Protection scanning

This is expected behavior when enabled. Advise users to check spam folders if not received within 15 minutes.

### Dashboard shows "Unverified" domain

**Root cause:** DNS propagation incomplete or incorrect CNAME values.

Fix:
1. Wait 24-48 hours for DNS propagation
2. Verify CNAME values match dashboard exactly (trailing dots matter)
3. Use `dig` to confirm records exist: `dig CNAME <record-name>`
4. Check with DNS provider — some require manual record activation

### "Domain reputation poor" in Postmaster Tools

**Root cause:** High bounce rate or spam complaints.

Recovery:
1. STOP all sending immediately
2. Clean email list — remove bounced addresses
3. Verify opt-in for all recipients
4. Wait 7-14 days for reputation reset
5. Resume sending at 10% previous volume
6. Gradually increase volume over 4 weeks

**Critical:** Domain reputation damage is cumulative. Multiple violations may result in permanent blacklisting.

### Debugging tools

- [Google Postmaster Tools](https://www.gmail.com/postmaster/) — Gmail deliverability metrics
- [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/) — Outlook deliverability
- [Mail Tester](https://www.mail-tester.com/) — Spam score testing
- [Litmus](https://www.litmus.com/email-testing) — Comprehensive email testing
- [Warmly](https://www.warmy.io/free-tools/email-deliverability-test/) — Deliverability testing

If issues persist after using these tools, contact WorkOS support with tool results.
