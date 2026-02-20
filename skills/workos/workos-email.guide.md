<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch SDK Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The Email docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Choose Email Strategy (Decision Tree)

```
Email delivery requirements?
  |
  +-- Need IMMEDIATE setup (testing/MVP)
  |     --> Use WorkOS email domain (workos-mail.com)
  |     --> Zero DNS config required
  |     --> Tradeoff: Lower trust, "unknown sender" experience
  |
  +-- Production app with brand trust needs
  |     --> Use your own email domain
  |     --> Requires DNS verification (3 CNAME records)
  |     --> Tradeoff: Setup time vs. deliverability
  |
  +-- Need full control (custom templates/provider/retry logic)
        --> Use event webhooks to send your own email
        --> Listen to WorkOS events, trigger own provider
        --> Tradeoff: Maximum flexibility, most implementation work
```

**Key architectural decision:** WorkOS sends emails for Magic Auth, password resets, invitations. Choose strategy based on whether you prioritize speed-to-market or deliverability.

## Step 3: DNS Configuration (If Using Your Domain)

**Skip if using WorkOS domain.**

Navigate to WorkOS Dashboard → Email Settings.

**Required DNS records:**

1. **Domain verification:** 1 CNAME record (proves ownership)
2. **SPF/DKIM authentication:** 2 CNAME records (SendGrid automated security)

**Critical:** All 3 CNAMEs must be added to your DNS provider before WorkOS can send from your domain. Partial configuration = emails fail silently.

**Verification command:**

```bash
# Replace example.com with your domain
dig CNAME _domainkey.example.com +short
dig CNAME em123.example.com +short
```

Both must return SendGrid subdomains. If empty, DNS not propagated yet (wait 5-60 minutes).

## Step 4: Sender Address Inbox Setup (Your Domain Only)

**Skip if using WorkOS domain.**

WorkOS sends from these addresses on your domain:

- `welcome@<your-domain>`
- `access@<your-domain>`

**Required:** Create mailboxes for both addresses with your email provider. Email providers (especially Google, Microsoft) check if sender addresses have real inboxes. Missing inboxes = spam filter triggers.

**Verification:** Send test email TO these addresses. If bounces, inbox not configured.

## Step 5: DMARC Policy Configuration (Recommended for Your Domain)

**Skip if using WorkOS domain.**

DMARC tells receiving servers what to do with emails that fail authentication. Required by Google/Yahoo for bulk senders.

Add this DNS TXT record:

```
TXT Record
Name: _dmarc.example.com
Content: v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com
```

**Policy options:**

- `p=none` → Monitor mode (collect reports, don't block)
- `p=quarantine` → Send suspicious emails to spam
- `p=reject` → Block suspicious emails entirely

**Verification command:**

```bash
dig TXT _dmarc.example.com +short
```

Should return your DMARC policy string. If empty, record not added yet.

## Step 6: Event Webhook Setup (If Sending Your Own Email)

**Skip if using WorkOS or your domain.**

WorkOS emits events when email should be sent. Your app listens to these events and triggers your email provider.

**Event types to subscribe to:**

- `magic_auth.created` → Send Magic Auth link
- `password_reset.created` → Send password reset link
- `invitation.created` → Send invitation email

Check fetched docs for complete event list and payload schemas.

**Webhook endpoint requirements:**

1. Return `200 OK` within 5 seconds
2. Verify signature before processing (prevents spoofing)
3. Process event asynchronously (queue job, don't block response)

**Signature verification pattern:**

```
# Pseudocode - use SDK method for webhook signature verification
webhook_secret = env.WORKOS_WEBHOOK_SECRET
signature = request.headers['WorkOS-Signature']
payload = request.body

if not workos.webhooks.verifySignature(payload, signature, webhook_secret):
  return 401 Unauthorized

# Queue email job, return immediately
queue.enqueue(SendEmailJob, event.data)
return 200 OK
```

**Trap warning:** Do NOT verify signature AFTER processing event. Verify first, process second.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm setup. **Do not mark complete until all pass:**

```bash
# 1. Check DNS records (if using your domain)
dig CNAME _domainkey.yourdomain.com +short
dig TXT _dmarc.yourdomain.com +short

# 2. Test sender inbox (if using your domain)
echo "Test" | mail -s "Inbox Test" welcome@yourdomain.com

# 3. Check webhook endpoint (if using events)
curl -X POST https://yourapp.com/webhooks/workos \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Should return 200 OK

# 4. Send test Magic Auth email via WorkOS API
# Use SDK method for sending test Magic Auth email
# Should receive email at test address
```

**If using your domain:** Wait 5-60 minutes for DNS propagation before testing.

## Error Recovery

### Emails not reaching inbox (spam filtered)

**Diagnose scope first:**

- **All users affected?** → Domain reputation issue (see "Poor domain reputation" below)
- **Only Gmail/Google Workspace?** → Google spam filter too aggressive
- **Only Microsoft 365?** → Microsoft spam filter too aggressive
- **Only one organization?** → That org's IT policies blocking

**For Gmail issues:**

1. Register domain at https://www.gmail.com/postmaster/
2. Check domain reputation score (should be "High" or "Medium")
3. Check spam rate (should be <0.1%)

**For Microsoft issues:**

1. Submit domain to https://sendersupport.olc.protection.outlook.com/pm/
2. Check junk mail reporting status

### Poor domain reputation

**Root causes:**

1. **Unsolicited invitations** → Sending invites to users who didn't request them (bulk email lists)
2. **Spam-trigger words in org names** → Org/team names contain "free", "winner", "click here", etc.
3. **No DMARC policy** → Receiving servers don't trust your domain

**Fix priority order:**

1. Stop ALL unsolicited invitations immediately
2. Audit organization names for spam words (check https://mailtrap.io/blog/email-spam-words/)
3. Add DMARC policy (Step 5)
4. Create sender inboxes (Step 4)

**Recovery timeline:** Domain reputation takes 2-4 weeks to recover after fixing issues.

### DNS verification failing

**Symptoms:** WorkOS Dashboard shows "Domain not verified" after adding CNAME records.

**Common causes:**

1. CNAME record name incorrect (missing subdomain prefix)
2. DNS not propagated yet (wait 5-60 minutes)
3. CNAME points to wrong target (typo in SendGrid subdomain)

**Verification:**

```bash
dig CNAME <record-name-from-dashboard> +short
```

Should return exact target shown in WorkOS Dashboard. If different, update DNS record.

### Webhook signature verification fails

**Symptoms:** Webhook returns 401, WorkOS retries event repeatedly.

**Common causes:**

1. Using wrong webhook secret (copied from different environment)
2. Verifying signature AFTER reading body (body consumed, can't re-read)
3. Signature header name case-sensitive mismatch

**Fix:**

1. Get webhook secret from Dashboard → Webhooks → [your endpoint] → Secret
2. Verify signature BEFORE processing body
3. Use exact header name: `WorkOS-Signature` (capital W, capital S)

### Emails delayed (Enhanced Pre-delivery Scanning)

**Symptoms:** Emails arrive 5-15 minutes late, only for some users.

**Root cause:** Google/Microsoft scanning links in email before delivery.

**This is NORMAL behavior.** Email providers scan for malicious links. Cannot be disabled by sender.

**Mitigation:** Set user expectations in UI ("Email may take up to 15 minutes").

## Spam Prevention Rules (CRITICAL)

**Never send invitations to:**

- Scraped email lists
- Purchased marketing lists
- Users who haven't explicitly requested access

**One violation = domain reputation permanently damaged.**

**Safe invitation patterns:**

- User types email address into "Invite teammate" form → SAFE
- Admin imports CSV of employee emails (company they work for) → SAFE
- Bulk invite 10,000 emails from trade show badge scan → UNSAFE

**Test:** "Did this specific person ask to receive email from my app?" If no → don't send.

## Related Skills

- workos-authkit-nextjs (uses email for Magic Auth)
- workos-authkit-react (uses email for password reset)
