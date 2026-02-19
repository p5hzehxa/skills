<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Delivery Strategy (Decision Tree)

WorkOS provides three email delivery modes. Choose based on your priorities:

```
Email delivery mode?
  |
  +-- Need to start quickly, minimal setup
  |   → Use WorkOS email domain (workos-mail.com)
  |   → Trade-off: Less brand recognition, no control over domain reputation
  |
  +-- Want branded sender, control over deliverability
  |   → Configure your own email domain
  |   → Requires: DNS configuration (CNAME records)
  |   → Addresses used: welcome@yourdomain.com, access@yourdomain.com
  |
  +-- Need full control over email content/provider
      → Use event-driven email (listen to WorkOS events, send via your provider)
      → Requires: Event webhook setup + your own email infrastructure
```

**IMPORTANT:** For strategies (A) and (B), WorkOS sends the email. For strategy (C), you send it. Do not mix approaches for the same email type.

## Step 3: Email Domain Configuration (if using your domain)

### Dashboard Setup

Navigate to WorkOS Dashboard → Email Settings.

Add your domain and configure DNS records at your domain provider:

1. **Ownership verification CNAME** (1 record)
2. **SPF/DKIM authentication CNAMEs** (2 records via SendGrid automated security)

Check fetched docs for exact record values — they are unique per domain.

**Verify:** Dashboard shows "Verified" status before proceeding. Unverified domains will not send email.

### Create Sender Inboxes (CRITICAL)

Email providers check if sender addresses have real inboxes. Create these inboxes at your domain:

- `welcome@yourdomain.com`
- `access@yourdomain.com`

**Do NOT skip this step.** Missing inboxes reduce deliverability.

### DMARC Configuration (REQUIRED for bulk senders)

If sending 5000+ emails/day, DMARC is required by Google/Yahoo/Apple guidelines.

Add DNS TXT record at your domain provider:

```
Record type: TXT
Name: _dmarc.yourdomain.com
Content: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

Check fetched docs for policy options (`p=reject`, `p=quarantine`, `p=none`).

**Why this matters:** Without DMARC, email providers may reject bulk email outright (not just spam filter).

## Step 4: Content Rules (TRAP WARNING)

### Do NOT Send Unsolicited Email

**CRITICAL:** WorkOS email domain reputation is shared across all tenants. Sending unsolicited email (e.g., marketing lists) will degrade deliverability for everyone.

**Safe pattern:** User explicitly requests access → invitation sent
**Unsafe pattern:** Import email list → bulk invite without consent

**Consequence:** Account suspension if unsolicited email is detected.

### Organization/Team Name Hygiene

WorkOS emails include your team name and organization names in email body. Avoid [spam trigger words](https://mailtrap.io/blog/email-spam-words/) in these names.

**Bad:** "Free Money Org", "Click Here LLC", "Urgent Action Corp"
**Good:** "Acme Corp", "Engineering Team", "Sales Division"

**Where to check:** WorkOS Dashboard → Organization names, Team settings

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm email setup:

```bash
# 1. Check DNS records are configured (if using your domain)
dig CNAME _domainkey.yourdomain.com +short
# Should return SendGrid CNAME values from dashboard

# 2. Check DMARC exists (if required)
dig TXT _dmarc.yourdomain.com +short
# Should return DMARC policy string

# 3. Trigger test email via WorkOS feature (invitation, magic auth, etc.)
# Then check email arrival in test inbox

# 4. Check sender inbox exists
# Manual: Try sending email TO welcome@yourdomain.com and access@yourdomain.com
# Should not bounce
```

**Do not mark complete until test email arrives in inbox (not spam folder).**

## Error Recovery

### Email arrives in spam folder (subset of users)

**Diagnosis:** Provider-specific filtering or organization IT policy, not domain reputation.

**Fixes:**
1. Ask affected users to mark as "Not Spam" and add sender to contacts
2. For corporate domains: Contact their IT to allowlist your domain
3. Check Google Postmaster Tools for Gmail-specific issues
4. Check Microsoft Sender Support for Outlook-specific issues

**Tools:**
- [Google Postmaster Tools](https://www.gmail.com/postmaster/) (Gmail/Workspace)
- [Microsoft Sender Support](https://sendersupport.olc.protection.outlook.com/pm/)

### Email arrives in spam folder (all users)

**Diagnosis:** Domain reputation issue.

**Fixes:**
1. Check you are NOT sending unsolicited email (see Step 4)
2. Verify DMARC record exists and is set to `p=reject` or `p=quarantine`
3. Verify sender inboxes (`welcome@`, `access@`) exist and are not bouncing
4. Run spam test: [Litmus](https://www.litmus.com/email-testing) or [Warmly](https://www.warmy.io/free-tools/email-deliverability-test/)
5. Review organization/team names for spam trigger words

**If issue persists after fixes:** Contact WorkOS support with spam test results.

### Email delayed (arrives 10+ minutes late)

**Diagnosis:** Google Enhanced Pre-delivery Message Scanning or similar provider feature.

**Not fixable on your side** — this is a recipient email provider setting. Email will eventually arrive.

**User education:** Let users know email may take 10-15 minutes during first send. Subsequent emails are usually faster.

### DNS records not verifying in dashboard

**Check:**
1. CNAME records entered exactly as shown in dashboard (no trailing dots unless specified)
2. DNS propagation complete (can take 24-48 hours) — use `dig` to verify
3. No conflicting TXT/CNAME records for same subdomain

**Propagation check:**
```bash
# Check if DNS sees your CNAME
dig CNAME _domainkey.yourdomain.com @8.8.8.8 +short
```

If empty after 48 hours, DNS records were not entered correctly.

### "Domain not verified" when sending email

**Fix:** Go back to Step 3 Dashboard Setup. Domain must show "Verified" status before WorkOS will send from it.

### Sender inbox bouncing email

**Fix:** Create real inboxes at your email provider (Google Workspace, Microsoft 365, etc.) — forwarding aliases are not sufficient. Email providers check for actual mailboxes.

## Related Skills

- workos-directory-sync (uses invitation email)
- workos-magic-auth (uses magic link email)
