<!-- refined:sha256:1f3ac3b3b606 -->

# WorkOS Email Delivery

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/email`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Understand Email Delivery Options

WorkOS provides three email delivery modes. Choose based on your requirements:

```
Email delivery mode?
  |
  +-- WorkOS domain (workos-mail.com)
  |   └─> Fastest setup, no DNS config
  |   └─> Use for: Dev/staging, MVP, low-volume apps
  |
  +-- Your domain (your-app.com)
  |   └─> Better deliverability, recognizable sender
  |   └─> Requires: DNS verification, CNAME records
  |   └─> Use for: Production apps, branded experience
  |
  +-- Custom provider (your SMTP/API)
      └─> Full control, existing provider integration
      └─> Requires: Webhook setup, event handling
      └─> Use for: Enterprise, compliance requirements
```

This skill focuses on **options A (WorkOS domain)** and **B (Your domain)**. For option C (custom provider), see webhook event handling documentation.

## Step 3: Pre-Flight Validation

### API Key Check

Verify environment variables exist:

```bash
# Check env vars are set
printenv | grep -E 'WORKOS_(API_KEY|CLIENT_ID)'
```

- `WORKOS_API_KEY` must start with `sk_`
- `WORKOS_CLIENT_ID` must start with `client_`

### SDK Installation

Confirm WorkOS SDK is installed before configuring email:

```bash
# Node.js example — adjust for your language
npm list @workos-inc/node || echo "SDK not installed"
```

If not installed, install SDK before proceeding. Check fetched docs for installation instructions for your language.

## Step 4: Email Domain Configuration (Option B)

**Skip this step if using WorkOS email domain (Option A).**

Navigate to WorkOS Dashboard → Email Settings.

### DNS Record Requirements

You must configure THREE CNAME records with your DNS provider:

1. **Domain verification** — proves you own the domain
2. **SPF authentication** — via SendGrid automated security
3. **DKIM authentication** — via SendGrid automated security

Dashboard will display the exact CNAME values. **Do not proceed until all three records are verified** — verification can take 24-48 hours.

```bash
# Verify CNAME propagation (replace example.com with your domain)
dig CNAME em1234.example.com
dig CNAME s1._domainkey.example.com
dig CNAME s2._domainkey.example.com
```

All three must return CNAME records pointing to SendGrid infrastructure before dashboard shows "Verified".

### Sender Address Pattern

When using your domain, WorkOS sends from these addresses:

- `welcome@<your-domain>` — for welcome/invitation emails
- `access@<your-domain>` — for authentication emails

**Action required:** Create mailboxes for both addresses with your email provider. Email providers check if sender addresses have valid inboxes — missing inboxes hurt deliverability.

### DMARC Configuration (CRITICAL)

**Required for Gmail/Google Workspace delivery starting 2024.**

Add a DNS TXT record at `_dmarc.<your-domain>`:

```
# Example DMARC policy (adjust based on your requirements)
v=DMARC1; p=reject; rua=mailto:dmarc-reports@your-domain.com; pct=100; adkim=s; aspf=s;
```

Key parameters:
- `p=reject` — reject unauthenticated email (strictest)
- `p=quarantine` — send to spam (moderate)
- `p=none` — monitor only (least strict, use for testing)

**Start with `p=none` for 1-2 weeks**, monitor reports, then escalate to `quarantine` or `reject`.

Check DMARC propagation:

```bash
dig TXT _dmarc.your-domain.com
```

Google/Yahoo require DMARC for senders above 5,000 messages/day. **Do not skip this step for production apps.**

## Step 5: Email Triggering (Implicit vs Explicit)

Email delivery is triggered by WorkOS feature usage. You do NOT call a "send email" API directly.

### Implicit Triggers (WorkOS handles email automatically)

These WorkOS features trigger email without additional code:

- **Magic Auth sign-in** → sends sign-in link to user's email
- **Email verification** → sends verification link after signup
- **Organization invitations** → sends invite to join organization
- **Password reset** → sends reset link

**Your responsibility:** Configure the feature (e.g., enable Magic Auth), WorkOS handles email delivery.

### Explicit Triggers (You call WorkOS API)

For invitation flows, you explicitly call the WorkOS API to trigger email:

**Pseudocode pattern:**

```
POST /user_management/invitations
{
  "email": "user@example.com",
  "organization_id": "org_12345",
  "expires_in_days": 7
}
```

Check fetched docs for exact SDK method signature in your language.

## Step 6: Spam Prevention Rules (CRITICAL)

Follow these rules to avoid WorkOS suspending your email delivery:

### Rule 1: No Unsolicited Email

**Allowed:**
- User requests access for themselves
- Admin invites specific user to their organization
- User initiates password reset

**Prohibited:**
- Bulk importing email list and sending invites
- Marketing campaigns via WorkOS email
- Cold outreach to users who didn't request access

**Violation result:** WorkOS will disable your email delivery without warning.

### Rule 2: Appropriate Naming

Avoid spam trigger words in:
- WorkOS team name (in dashboard settings)
- Organization names (created via API)

**Prohibited terms:** "lottery", "prize", "free money", "Nigerian prince", etc. See [common spam words list](https://mailtrap.io/blog/email-spam-words/).

**Check your names:**

```bash
# Audit organization names via API
# Check fetched docs for exact endpoint/SDK method to list organizations
```

If you find problematic names, rename via dashboard or API before enabling email.

## Step 7: Testing Email Delivery

### Test Flow

1. Trigger an email event (e.g., send invitation via API)
2. Check recipient inbox within 60 seconds
3. If not in inbox, check spam folder
4. If in spam, proceed to troubleshooting

### Deliverability Testing Tools

Use these tools to diagnose spam filtering:

- **Google Postmaster Tools** — for Gmail/Google Workspace
  URL: `https://postmaster.google.com`
  
- **Microsoft Sender Support** — for Outlook/Office 365
  URL: `https://sendersupport.olc.protection.outlook.com/pm/`
  
- **Litmus** — multi-provider spam testing
  URL: `https://www.litmus.com/email-testing`

Sign up with your sending domain BEFORE sending test emails. These tools require historical data.

## Verification Checklist (ALL MUST PASS)

Run these checks before marking integration complete:

```bash
# 1. Environment variables configured
printenv | grep -E 'WORKOS_(API_KEY|CLIENT_ID)' || echo "FAIL: Env vars missing"

# 2. DNS records verified (Option B only)
dig CNAME em1234.example.com +short | grep -q sendgrid || echo "WARN: CNAME not verified"

# 3. DMARC configured (Option B only)
dig TXT _dmarc.example.com +short | grep -q "v=DMARC1" || echo "WARN: DMARC missing"

# 4. Test email delivered
# Manually trigger test email and confirm receipt within 60 seconds
```

If any checks fail, return to the relevant step.

## Error Recovery

### "Email not received" (all users affected)

**Root cause:** Domain reputation issue or missing DNS records.

**Fix path:**

1. Check DNS propagation (Step 4 verification commands)
2. Check DMARC policy is not too strict (use `p=none` for testing)
3. Verify sender addresses have mailboxes (Step 4)
4. Check Google Postmaster Tools for domain reputation score
5. If domain reputation is "Bad" or "Low", contact WorkOS support — you may need to warm up the domain

### "Email not received" (specific users/domains affected)

**Root cause:** Recipient-specific spam filtering.

**Fix path:**

1. Ask recipient to check spam folder
2. If in spam, ask recipient to mark as "Not Spam" and add sender to contacts
3. For corporate domains (e.g., company.com), recipient IT may need to allowlist sender domain
4. Check if recipient domain uses aggressive scanning (e.g., Google Enhanced Pre-delivery Scanning)
5. If issue persists, provide recipient with Microsoft Sender Support or Google Postmaster data

### "Email delayed" (arrives after 5+ minutes)

**Root cause:** Pre-delivery scanning or greylisting by recipient mail server.

**Fix path:**

1. Check if recipient uses Google Workspace with Enhanced Pre-delivery Message Scanning
2. Check if recipient mail server is greylisting (temporary rejection to throttle spam)
3. **No action required** — delivery will complete, but may take 10-30 minutes
4. For time-sensitive flows (e.g., Magic Auth), show "Check spam folder" message after 2 minutes

### "WorkOS suspended email delivery"

**Root cause:** Violation of spam prevention rules (Step 6).

**Fix path:**

1. Review email sending logs for bulk patterns
2. Check if invitation flow allows self-service bulk imports
3. Audit organization names for spam trigger words
4. Contact WorkOS support to appeal suspension
5. After appeal, implement stricter validation on invitation endpoints

### "CNAME verification stuck on Pending"

**Root cause:** DNS propagation delay or incorrect CNAME value.

**Fix path:**

```bash
# 1. Verify you added the EXACT CNAME value from dashboard
dig CNAME em1234.example.com +short

# 2. Check if CNAME points to SendGrid infrastructure (u12345.wl.sendgrid.net)
# If CNAME is missing or points elsewhere, re-add with correct value

# 3. Wait 24 hours for propagation
# DNS changes can take up to 48 hours to propagate globally

# 4. Try verification from different network
# Some ISPs cache DNS longer than others
```

If still stuck after 48 hours, check with your DNS provider for zone file errors.

## Related Skills

- workos-authkit-nextjs — for Magic Auth email integration
- workos-authkit-react — for client-side Magic Auth flows
