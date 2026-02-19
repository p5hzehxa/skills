---
name: workos-email
description: Configure email delivery for WorkOS authentication flows.
---

<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Understand Email Delivery Options (Decision Tree)

WorkOS provides three email delivery strategies. Choose based on control/convenience trade-off:

```
Email delivery strategy?
  |
  +-- WorkOS domain (workos-mail.com)
  |     └─> Fast setup, no DNS config
  |     └─> Users see @workos-mail.com sender
  |     └─> Limited deliverability control
  |
  +-- Your domain (your-brand.com)
  |     └─> Requires DNS configuration (CNAME, DMARC)
  |     └─> Users see @your-brand.com sender
  |     └─> More deliverability control
  |     └─> Better brand recognition
  |
  +-- Self-managed (webhook events)
        └─> Full control over provider (SendGrid, Postmark, etc.)
        └─> Requires webhook implementation
        └─> Most complex, most flexible
```

**For most production apps:** Use "Your domain" option. Balance between convenience and control.

**For rapid prototyping:** Use "WorkOS domain" option initially, migrate to your domain before launch.

**For enterprise with existing email infrastructure:** Use "Self-managed" option.

## Step 3: Implementation Pattern by Strategy

### Pattern A: WorkOS Domain (Zero Configuration)

No code changes required. Email works immediately after WorkOS feature setup (AuthKit, Admin Portal, etc.).

**Verify WorkOS is sending:**
```bash
# Check WorkOS dashboard logs for email events
# Dashboard > Logs > Filter by "email"
```

**Limitation:** Sender will be `@workos-mail.com`. Proceed to Step 4 for anti-spam rules.

### Pattern B: Your Email Domain (RECOMMENDED)

**Dashboard configuration (BLOCKING):**

1. Navigate to WorkOS Dashboard > Email Delivery
2. Add your domain (e.g., `example.com`)
3. Dashboard will show 3 CNAME records:
   - Verification record
   - SPF/DKIM record 1
   - SPF/DKIM record 2

**DNS configuration steps:**

1. Copy CNAME records from dashboard
2. Add records to your DNS provider (Cloudflare, Route53, etc.)
3. Wait for DNS propagation (5-60 minutes)
4. Return to dashboard, click "Verify Domain"

**Create email inboxes (IMPORTANT):**

WorkOS sends from:
- `welcome@yourdomain.com`
- `access@yourdomain.com`

Set up actual inboxes for these addresses with your email provider. Inbox existence improves deliverability scoring.

**Verify DNS records propagated:**
```bash
# Check CNAME record exists
dig CNAME _workos.yourdomain.com

# Should return CNAME pointing to WorkOS verification domain
# Non-empty output = propagated, empty = still pending
```

**Set up DMARC record:**

Add TXT record to DNS:
```
Type: TXT
Name: _dmarc.yourdomain.com
Value: v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

Check DMARC policy syntax:
```bash
dig TXT _dmarc.yourdomain.com
# Should return the policy string
```

**Proceed to Step 4 for anti-spam rules.**

### Pattern C: Self-Managed Email (Webhook Implementation)

**Webhook setup:**

1. Dashboard > Webhooks > Create Endpoint
2. Register URL: `https://yourdomain.com/webhooks/workos`
3. Subscribe to email events: `email.*`

**Implementation pseudocode:**

```typescript
// POST /webhooks/workos
async function handleWorkOSWebhook(request) {
  // 1. Verify signature (check fetched docs for exact method)
  const isValid = verifyWorkOSSignature(request.headers, request.body);
  if (!isValid) return 401;

  // 2. Parse event
  const event = JSON.parse(request.body);
  
  // 3. Route by event type
  if (event.type.startsWith('email.')) {
    const { to, subject, body, template_id } = event.data;
    
    // 4. Send via your provider
    await yourEmailProvider.send({ to, subject, body });
  }
  
  // 5. Return 200 immediately (WorkOS expects fast ACK)
  return 200;
}
```

**Event type pattern:** `email.{action}.{reason}`

Examples: `email.invitation.sent`, `email.password_reset.requested`

**Check fetched docs for:**
- Complete event schema
- Signature verification method
- Retry policy and idempotency

**Verify webhook receiving events:**
```bash
# Check your webhook logs for POST requests from WorkOS
grep "workos-signature" /var/log/nginx/access.log | tail -n 10

# Or use Dashboard > Webhooks > Event History to see delivery status
```

## Step 4: Anti-Spam Configuration (ALL STRATEGIES)

**Critical rules to prevent spam filtering:**

### Rule 1: No Unsolicited Email

**Violation example:**
```typescript
// BAD: Bulk inviting from marketing list
marketingList.forEach(email => {
  workos.inviteUser(email); // Will trigger spam filters
});
```

**Correct pattern:**
```typescript
// GOOD: User explicitly requests invitation
if (userClickedInviteButton) {
  workos.inviteUser(targetEmail); // Legitimate, user-initiated
}
```

### Rule 2: Avoid Spam Keywords in Names

**Check organization and team names:**
```bash
# Grep for common spam words in your org name configs
grep -iE "(free|win|click here|urgent|guarantee)" config/organizations.json
```

Common spam trigger words to avoid:
- "FREE", "WIN", "CLICK HERE"
- "URGENT", "ACT NOW"
- "GUARANTEE", "RISK-FREE"

**Pattern:** Use plain business names. "Acme Corp" not "URGENT - Acme FREE TRIAL".

### Rule 3: Warm Up New Domains

If using your own domain for the first time:

1. Start with low volume (< 100 emails/day)
2. Gradually increase over 2-4 weeks
3. Monitor bounce rates (should be < 2%)

**Check bounce rate:**
```bash
# Dashboard > Email Delivery > Analytics
# Bounce rate > 5% = deliverability problem
```

## Step 5: Test Email Delivery

**Pre-production testing:**

1. Send test email via WorkOS feature (Magic Auth, invitation, etc.)
2. Check recipient inbox (Gmail, Outlook, ProtonMail recommended for coverage)
3. Verify email is NOT in spam folder
4. Check email headers for authentication passes:
   ```
   DKIM: PASS
   SPF: PASS
   DMARC: PASS
   ```

**View email headers in Gmail:**
Show original > Look for "Authentication-Results" header

**Automated deliverability testing:**
- Use Litmus.com or similar for multi-client testing
- Use mail-tester.com for spam score (aim for 9+/10)

## Verification Checklist (ALL MUST PASS)

```bash
# 1. If using your domain: DNS records are set
dig CNAME _workos.yourdomain.com | grep -q "ANSWER SECTION" && echo "PASS: Domain verification record exists" || echo "FAIL: No CNAME record found"

dig TXT _dmarc.yourdomain.com | grep -q "v=DMARC1" && echo "PASS: DMARC policy exists" || echo "FAIL: No DMARC record found"

# 2. If using your domain: Inboxes exist
# Manually verify welcome@ and access@ inboxes are set up

# 3. Test email sends successfully
# Send a test Magic Auth or invitation email
# Verify it arrives in inbox (not spam) within 60 seconds

# 4. If using webhooks: Endpoint receives events
curl -I https://yourdomain.com/webhooks/workos
# Should return 200 or 405 (method not allowed), not 404

# 5. Check Dashboard logs show no errors
# Dashboard > Logs > Filter by "email" > No error status codes in last hour
```

## Error Recovery

### "Email not received" (all users affected)

**Root cause:** Domain reputation or authentication failure.

**Fix steps:**

1. Check DMARC/SPF/DKIM records:
   ```bash
   dig TXT _dmarc.yourdomain.com
   dig CNAME _workos.yourdomain.com
   ```
   If empty → DNS records not propagated yet (wait 1 hour, retry)

2. Check Dashboard > Email Delivery > Analytics for bounce rate
   - Bounce rate > 5% → invalid recipient addresses or blacklisted domain
   - Hard bounces → remove invalid addresses from send list

3. Check Google Postmaster Tools (if targeting Gmail users):
   - Domain reputation score (should be "High")
   - Spam rate (should be < 0.1%)

4. If domain reputation is "Low" or "Bad":
   - Review recent email content for spam keywords
   - Reduce send volume for 1-2 weeks
   - Check if domain is on blacklist: `https://mxtoolbox.com/blacklists.aspx`

### "Email not received" (specific users/domains)

**Root cause:** Recipient email provider's custom spam rules.

**Fix steps:**

1. Ask user to check spam folder manually
2. Ask user to whitelist sender address
3. If corporate domain (e.g., @bigcorp.com):
   - Contact their IT department
   - Provide SPF/DKIM records for whitelisting
   - Ask them to check their email gateway logs

4. Google Workspace users with Enhanced Pre-delivery Scanning:
   - Emails may be delayed 5-10 minutes (not lost)
   - No fix available, inform users of delay

5. Microsoft 365 aggressive filtering:
   - Use Microsoft Sender Support: `https://sendersupport.olc.protection.outlook.com/pm/`
   - Request delisting if domain is incorrectly flagged

### "Email delayed" (arrives after 10+ minutes)

**Root cause:** Greylisting or enhanced scanning.

**Not an error:** Some providers delay first email from new sender as anti-spam measure. Subsequent emails will be faster.

**Check:** Dashboard > Logs > View event timestamp vs. user report time
- If event shows "delivered" but user received 15 min later → provider delay, not WorkOS issue

### "Bounce: invalid recipient"

**Root cause:** Email address doesn't exist or has typo.

**Fix pattern:**

```typescript
// Implement email validation before sending
function isValidEmail(email: string): boolean {
  // Basic syntax check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  
  // Check MX records exist (optional but recommended)
  const domain = email.split('@')[1];
  const mxRecords = await dns.resolveMx(domain);
  return mxRecords.length > 0;
}

// Only send if validation passes
if (await isValidEmail(targetEmail)) {
  workos.sendInvitation(targetEmail);
}
```

### "Webhook not receiving events"

**Root cause:** Endpoint URL incorrect or signature verification failing.

**Fix steps:**

1. Verify webhook endpoint is publicly accessible:
   ```bash
   curl -X POST https://yourdomain.com/webhooks/workos \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   # Should NOT return 404
   ```

2. Check Dashboard > Webhooks > Event History for delivery failures
   - Status 4xx/5xx → endpoint returning error
   - "Connection refused" → firewall blocking WorkOS IPs

3. Check signature verification is correct:
   - Signature header name: `workos-signature`
   - Check fetched docs for exact verification method
   - Common mistake: using wrong signing secret

4. Ensure endpoint returns 200 within 5 seconds:
   ```typescript
   // CORRECT: Return 200 immediately, process async
   async function handleWebhook(event) {
     queueForProcessing(event); // Non-blocking
     return 200; // Return immediately
   }
   
   // WRONG: Slow processing blocks response
   async function handleWebhook(event) {
     await sendEmailViaProvider(event); // Blocks for seconds
     return 200; // WorkOS may timeout before this
   }
   ```

## Related Skills

- workos-authkit-nextjs — Implements Magic Auth which triggers email sending
- workos-authkit-react — Client-side auth flows that use email verification
