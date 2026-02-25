<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Strategy (Decision Tree)

```
What email UX do you need?
  |
  +-- Quick setup, no custom branding
  |   → Use WorkOS email domain (workos-mail.com)
  |   → Skip to Step 5 (no DNS config needed)
  |
  +-- Users must see YOUR domain in sender address
  |   → Configure your email domain
  |   → Continue to Step 3
  |
  +-- Full control over email content/provider
      → Use webhook events to trigger your own email
      → See workos-webhooks skill for event handling
      → Your app sends email via your provider (SendGrid, AWS SES, etc.)
```

**Critical:** WorkOS sends email automatically for Auth features (Magic Auth, invitations, password resets). This skill is about CONFIGURING the sender domain, not writing email sending code.

## Step 3: Dashboard DNS Configuration (If Using Your Domain)

Navigate to WorkOS Dashboard → Email Settings.

You will add 3 CNAME records to your domain provider:

1. **Ownership verification** — proves you control the domain
2. **SPF record** — authorizes WorkOS to send from your domain
3. **DKIM record** — cryptographically signs emails

**Trap warning:** Do NOT attempt to manually configure SPF/DKIM TXT records. WorkOS uses SendGrid's automated security — the CNAMEs handle this for you. If you add custom SPF/DKIM records, authentication will break.

Check fetched docs for exact CNAME values — they are unique per account.

### Sender Addresses

WorkOS sends from:

- `welcome@<your-domain>` — welcome emails, invitations
- `access@<your-domain>` — Magic Auth, password resets

**Set up actual inboxes** for both addresses. Email providers check if sender addresses are real. No inbox = higher spam score.

### DMARC Setup (OPTIONAL BUT RECOMMENDED)

DMARC tells receiving servers what to do if SPF/DKIM checks fail.

Add a TXT record to `_dmarc.<your-domain>`:

```
v=DMARC1; p=none; rua=mailto:dmarc-reports@<your-domain>
```

Start with `p=none` (monitor only). After verifying delivery, escalate to `p=quarantine` or `p=reject`.

**Why this matters:** Without DMARC, spoofed emails from your domain are hard to detect. DMARC + SPF + DKIM = full email authentication.

## Step 4: Content Restrictions (CRITICAL)

WorkOS emails include:

- Your **team name** from dashboard settings
- **Organization names** from your WorkOS organizations
- Standard email body text (controlled by WorkOS)

**Spam trigger warning:** If your team/org names contain spam words ("FREE", "WINNER", "URGENT", "CLICK HERE", "LIMITED TIME"), deliverability suffers even with perfect DNS config.

[Common spam words list](https://mailtrap.io/blog/email-spam-words/)

**Unsolicited email prohibition:** Only send invitations when a user explicitly requests access. Do NOT bulk invite from marketing lists. This violates anti-spam laws and will destroy your domain reputation.

## Step 5: Verification Checklist (ALL MUST PASS)

```bash
# 1. Check DNS propagation (if using your domain)
dig CNAME _workos.<your-domain> +short | grep -q workos && echo "✓ ownership verified" || echo "✗ DNS not propagated"

# 2. Verify sender inboxes exist (if using your domain)
# Manual: Send test email to welcome@<your-domain> and access@<your-domain>
# Both should reach a real inbox

# 3. Check DMARC record (if configured)
dig TXT _dmarc.<your-domain> +short | grep -q DMARC1 && echo "✓ DMARC set" || echo "✗ no DMARC"

# 4. Test email delivery (trigger an auth flow that sends email)
# Example: Create Magic Auth link via SDK → check recipient inbox
```

**Do not mark complete until verification emails arrive in inbox (not spam folder).**

## Error Recovery

### Emails not arriving for ANY users

**Root cause:** Domain reputation issue or DNS misconfiguration.

**Fix:**

1. Verify all 3 CNAME records propagated: `dig CNAME <record-name> +short`
2. Check [Google Postmaster Tools](https://www.gmail.com/postmaster/) for domain reputation score
3. Review team/org names for spam trigger words
4. Confirm no bulk invitations were sent recently (damages reputation)

### Emails only delayed/filtered for specific providers (Gmail, Outlook)

**Root cause:** Aggressive spam filters or Enhanced Pre-delivery Scanning.

**Fix:**

1. Gmail users: Check [Postmaster Tools](https://www.gmail.com/postmaster/) spam rate
2. Outlook users: Check [Sender Support](https://sendersupport.olc.protection.outlook.com/pm/)
3. Ask affected users to check spam folder, mark as "Not Spam" (trains filter)
4. Verify DMARC policy is set (helps with provider trust)

### DNS records not propagating

**Root cause:** TTL values or provider delay.

**Fix:**

1. Wait 24-48 hours for global DNS propagation
2. Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS) or `ipconfig /flushdns` (Windows)
3. Check authoritative nameserver directly: `dig @<your-nameserver> CNAME <record> +short`

### "Domain already in use" error

**Root cause:** Domain configured in another WorkOS account.

**Fix:**

1. Remove domain from old account first
2. Contact WorkOS support if you don't have access to old account

### Emails arrive but fail DKIM/SPF checks

**Root cause:** Custom SPF/DKIM records conflicting with WorkOS CNAMEs.

**Fix:**

1. Remove any manual SPF/DKIM TXT records for your domain
2. Keep ONLY the WorkOS-provided CNAMEs — they handle SPF/DKIM automatically
3. Wait 30 minutes for DNS changes to propagate
4. Send test email, check headers for `PASS` on both SPF and DKIM

## Related Skills

- workos-webhooks (for custom email sending via events)
- workos-magic-auth (triggers welcome@ emails)
- workos-user-management (triggers access@ emails)
