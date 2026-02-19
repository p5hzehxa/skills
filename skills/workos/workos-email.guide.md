<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The documentation is the source of truth. If this skill conflicts with the docs, follow the docs.

## Step 2: Choose Email Strategy (Decision Tree)

WorkOS provides three email delivery approaches. Choose based on your control/convenience trade-off:

```
Email strategy?
  |
  +-- WorkOS email domain (workos-mail.com)
  |     ├─ Fastest setup (no DNS config)
  |     ├─ Lower deliverability than custom domain
  |     └─ Users see emails from unfamiliar domain
  |
  +-- Your email domain (recommended)
  |     ├─ Requires DNS verification (3 CNAME records)
  |     ├─ Better deliverability (users recognize sender)
  |     └─ You control domain reputation
  |
  +-- Event-based (send your own)
        ├─ WorkOS emits events, you handle sending
        ├─ Maximum customization and control
        └─ You manage email provider integration

```

**Default choice:** Your email domain. Provides best user experience with manageable setup cost.

## Step 3A: Using WorkOS Email Domain (Simplest Path)

If you chose the WorkOS email domain:

1. No configuration required — WorkOS sends from `workos-mail.com` automatically
2. Skip to Step 4 (Content Guidelines)

**Trade-off:** Lower deliverability due to shared domain reputation. Users may not recognize sender.

## Step 3B: Using Your Email Domain (Recommended)

If you chose your own email domain:

### DNS Configuration

Navigate to: WorkOS Dashboard → Settings → Email Domain

You will need to create **3 CNAME records** with your DNS provider:

1. **Domain verification** — proves you own the domain
2. **SPF authentication** — via SendGrid's automated security
3. **DKIM authentication** — via SendGrid's automated security

Check fetched docs for the exact CNAME values to use — they are unique to your account.

**Verification command:**

```bash
# Replace example.com with your domain
dig CNAME _workos.example.com +short
# Should return WorkOS verification value
```

### Email Addresses

WorkOS will send from these addresses on your domain:

- `welcome@yourdomain.com` — onboarding and invitation emails
- `access@yourdomain.com` — authentication emails (password reset, Magic Auth)

### Create Actual Inboxes (CRITICAL)

Email providers check if sender addresses have real inboxes. Create mailboxes for both addresses:

```bash
# Verify inboxes exist - should not bounce
echo "Test" | mail -s "Inbox check" welcome@yourdomain.com
echo "Test" | mail -s "Inbox check" access@yourdomain.com
```

**Trap:** Forgetting to create the inboxes reduces deliverability. This is easy to miss because the DNS records will verify successfully.

### DMARC Policy (Required for Google/Yahoo)

Add a DNS TXT record for DMARC. This tells receiving servers how to handle emails that fail authentication.

**Minimal DMARC record:**

```
TXT Record
Name: _dmarc.yourdomain.com
Content: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

**Strict DMARC record (recommended after monitoring):**

```
TXT Record
Name: _dmarc.yourdomain.com
Content: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

Start with `p=none` to monitor, then move to `p=reject` once you confirm legitimate emails pass.

**Verification command:**

```bash
dig TXT _dmarc.yourdomain.com +short
# Should return your DMARC policy
```

Check fetched docs for DMARC policy options and their meanings.

## Step 3C: Event-Based Email (Maximum Control)

If you chose event-based email:

1. WorkOS emits events when email should be sent (e.g., `user.invitation_created`)
2. Subscribe to events via Webhooks
3. Use your own email provider (SendGrid, Postmark, etc.) to send

Check fetched docs for:
- Event type naming conventions
- Webhook setup instructions
- Event payload schemas

**Related Skills:**
- workos-webhooks (for event subscription patterns)

## Step 4: Content Guidelines (All Strategies)

### Organization and Team Names

WorkOS emails include:
- Your team account name
- Organization names under your team

**Trap:** Names with spam trigger words reduce deliverability. Avoid:
- "Free", "Winner", "Click here", "Urgent"
- ALL CAPS text
- Excessive punctuation (!!!, $$$)

Check [common spam words list](https://mailtrap.io/blog/email-spam-words/) before naming organizations.

**Verification command:**

```bash
# Check for spam words in your team/org names
curl -s https://mailtrap.io/blog/email-spam-words/ | \
  grep -i -f <(echo "YOUR_TEAM_NAME\nYOUR_ORG_NAME") && \
  echo "WARNING: Potential spam words detected"
```

### Prevent Unsolicited Email

**CRITICAL:** Only send email when a user explicitly requests it.

**Allowed triggers:**
- User requests password reset
- Admin invites specific user by email
- User signs up and triggers welcome flow

**Forbidden triggers:**
- Bulk imports from marketing lists
- Automated enrollment without user action
- Speculative invitations to drive signups

**Trap:** Sending unsolicited email from WorkOS domain damages shared reputation, affecting all WorkOS customers.

## Verification Checklist (ALL MUST PASS)

If using your email domain, run these commands:

```bash
# 1. DNS verification
dig CNAME _workos.yourdomain.com +short
# Should return WorkOS verification string

# 2. SPF/DKIM records (via SendGrid)
dig CNAME s1._domainkey.yourdomain.com +short
dig CNAME s2._domainkey.yourdomain.com +short
# Should return SendGrid DKIM values

# 3. DMARC policy
dig TXT _dmarc.yourdomain.com +short
# Should return v=DMARC1; p=...

# 4. Inbox existence (should not bounce)
echo "Test" | mail -s "Inbox check" welcome@yourdomain.com
echo "Test" | mail -s "Inbox check" access@yourdomain.com

# 5. Check WorkOS Dashboard shows "Verified"
# Manual check required
```

**Do not mark complete until all checks pass.**

## Error Recovery

### Email Not Reaching Users

**Diagnosis tree:**

```
Who is affected?
  |
  +-- All users
  |     └─ Likely domain reputation issue
  |         ├─ Check DMARC/SPF/DKIM records
  |         ├─ Review organization/team names for spam words
  |         └─ Use Google Postmaster Tools (see below)
  |
  +-- Only Gmail/Google Workspace users
  |     └─ Enhanced Pre-delivery Scanning may delay emails
  |         ├─ User should check spam folder
  |         └─ Use Google Postmaster Tools to check domain reputation
  |
  +-- Only Microsoft/Outlook users
  |     └─ Check Microsoft Sender Support (see below)
  |
  +-- Specific organization/email provider
        └─ Organization's IT may have custom filters
            └─ Ask IT admin to allowlist yourdomain.com
```

### DNS Records Not Verifying

**Symptoms:** WorkOS Dashboard shows "Pending" status after 24 hours

**Root causes:**

1. **Wrong DNS zone** — CNAME was added to subdomain instead of apex domain
   - Fix: Verify you're editing the correct zone file
2. **TTL not expired** — Old DNS records still cached
   - Fix: Wait for TTL to expire (check `dig` output for TTL value)
3. **Proxy enabled** — Cloudflare/similar proxy intercepts CNAME
   - Fix: Disable proxy (set to "DNS only" mode) for WorkOS CNAMEs

**Verification command:**

```bash
# Check from multiple DNS servers to confirm propagation
dig @8.8.8.8 CNAME _workos.yourdomain.com +short
dig @1.1.1.1 CNAME _workos.yourdomain.com +short
# Results should match and return WorkOS value
```

### Emails Going to Spam

**Tools for diagnosis:**

- **Google Postmaster Tools:** https://postmaster.google.com
  - Check domain reputation, spam rate, authentication rate
  - Requires domain ownership verification
- **Microsoft Sender Support:** https://sendersupport.olc.protection.outlook.com/pm/
  - Check delisting status if blocked by Outlook
- **Generic spam testers:**
  - Litmus: https://www.litmus.com/email-testing
  - Warmly: https://www.warmy.io/free-tools/email-deliverability-test/

**Common fixes:**

1. **DMARC policy too lax** — Move from `p=none` to `p=quarantine` or `p=reject`
2. **Missing DKIM/SPF** — Re-verify CNAME records are correct
3. **Inbox doesn't exist** — Create mailboxes for welcome@ and access@ addresses
4. **Spam trigger words** — Rename organizations/team to remove flagged terms

### Email Delayed (Not Spam, Just Slow)

**Root cause:** Enhanced scanning features at recipient's email provider (Google Workspace, Microsoft 365)

**Fix:** No action required — emails will arrive once scanning completes (typically 5-30 minutes)

**User workaround:** Check spam folder, mark as "Not Spam" to train filters

### "Domain Already Claimed" Error

**Root cause:** Another WorkOS team already verified this domain

**Fix:** Contact WorkOS support to transfer domain ownership or use a subdomain (e.g., `mail.yourdomain.com`)

## Next Steps

After email delivery is configured:

- Test invitation flows with real email addresses
- Monitor Google Postmaster Tools for domain reputation trends
- Set up DMARC reporting (`rua=` parameter) to catch authentication failures

If issues persist despite following these steps, contact WorkOS support with:
- Domain name
- DNS record outputs (from dig commands above)
- Example recipient email addresses showing the problem
