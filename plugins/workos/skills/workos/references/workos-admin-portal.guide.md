<!-- refined:sha256:479288befe44 -->

# WorkOS Admin Portal

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/admin-portal/index
- https://workos.com/docs/admin-portal/example-apps
- https://workos.com/docs/admin-portal/custom-branding

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

Check `.env` or environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify API key:**

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ invalid/missing"
```

## Step 3: Integration Path (Decision Tree)

```
Who creates the setup link?
  |
  +-- Dashboard admin manually --> Go to Step 4 (Dashboard Setup)
  |
  +-- Your app programmatically --> Go to Step 5 (SDK Setup)
```

Most B2B apps generate setup links programmatically. Manual dashboard setup is for testing or low-volume scenarios.

## Step 4: Dashboard Setup (Manual Path)

This path is for **testing only** — production apps should use Step 5.

Navigate: Dashboard → Organizations → Create Organization

Dashboard generates setup link automatically. Copy and share with IT admin.

**Link properties:**

- One active link per organization at a time
- Revoke via "Manage" button before creating new link
- Check fetched docs for expiration policy

Skip to Step 6.

## Step 5: SDK Setup (Programmatic Path)

### Create Organization via SDK

Use SDK method for organization creation. Check fetched docs for exact method signature and required parameters.

**Common pattern (language-agnostic):**

```
org = workos.organizations.create(
  name: "Customer Corp",
  domains: ["customercorp.com"]
)
```

Store `org.id` — you'll need it for setup link generation.

### Generate Setup Link

```
What features does the admin configure?
  |
  +-- SSO only --> portal.generate_link(org_id, intent: "sso")
  |
  +-- Directory Sync only --> portal.generate_link(org_id, intent: "dsync")
  |
  +-- Multiple features --> portal.generate_link(org_id, intent: "sso dsync")
```

**CRITICAL:** Intent parameter determines which configuration screens appear in the portal. Check fetched docs for available intent values.

The SDK returns a `{ link, expires_at }` object. The link is single-use and time-limited.

### Deliver Setup Link

**Trap warning:** Do NOT email the link directly from your backend. Instead:

1. Store link in your database with organization context
2. Send notification to IT admin: "Configure SSO → [Your App Settings Page]"
3. Your settings page retrieves stored link and redirects

**Why:** Prevents link exposure in email logs. Your app controls access and can track completion.

## Step 6: Verification

Run these commands to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || pip show workos || echo "SDK not found"

# 2. Check environment variables set
env | grep WORKOS_ || echo "FAIL: WorkOS env vars missing"

# 3. Test organization creation (if using SDK path)
# Run your org creation function and check for org_id in output

# 4. Test link generation (if using SDK path)
# Run your link generation function and verify link starts with expected URL
```

**All must pass before marking complete.**

## Error Recovery

### "Unauthorized" on API call

**Root cause:** API key invalid or missing permissions.

**Fix:**

1. Check key starts with `sk_` (not `pk_` — that's publishable key)
2. Regenerate key in Dashboard → API Keys if needed
3. Verify key has Admin Portal permissions enabled

### Setup link 404s when visited

**Root cause:** Link expired or already used (single-use).

**Fix:**

1. Check `expires_at` timestamp from link generation
2. Generate new link — do NOT reuse old links
3. For frequent regeneration, implement link refresh flow in your app

### IT admin sees wrong features in portal

**Root cause:** Intent parameter mismatch.

**Fix:**

1. Check intent value passed to `generate_link()` matches enabled features
2. Valid intents documented in fetched docs (typically `"sso"`, `"dsync"`, or combined)
3. Intent cannot be changed after link generation — must generate new link

### Organization domains not verified

**Root cause:** Domain verification required before SSO works.

**Fix:**
Check fetched docs for domain verification requirements. Some configurations require DNS TXT record or email verification before SSO activation.

## Related Skills

For embedding Admin Portal in your auth flow:

- workos-authkit-nextjs
- workos-authkit-react
