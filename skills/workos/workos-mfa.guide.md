<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

Store as managed secrets, not committed to source control.

### SDK Installation

Confirm SDK package exists in your dependency manifest before writing code.

**Verify:** SDK import statement resolves without errors.

## Step 3: Factor Type Selection (Decision Tree)

```
User enrollment preference?
  |
  +-- Authenticator app (Google Auth, Authy, 1Password)
  |     --> Use `totp` factor type
  |     --> Response includes `qr_code` (base64 data URI) + `secret`
  |     --> Display QR code for scanning OR allow manual secret entry
  |
  +-- SMS text message
        --> Use `sms` factor type
        --> Requires valid phone number (E.164 format recommended)
        --> Invalid numbers fail immediately with error
```

**Critical:** Do NOT use MFA API with WorkOS SSO. SSO providers have their own MFA — use that instead.

## Step 4: Enrollment Flow

### Enrollment Pattern (Both Factor Types)

1. Call SDK method to create authentication factor with chosen type
2. **PERSIST THE FACTOR ID** in your user model (database, session store, etc.)
3. For TOTP: display QR code + secret for user to scan/enter
4. For SMS: send verification challenge to confirm phone number works

**Trap:** If you don't persist the factor ID, you cannot create challenges later. This is YOUR responsibility — WorkOS doesn't store user-to-factor mappings.

Check fetched docs for exact SDK method signatures for factor creation.

## Step 5: Challenge Creation

When user needs to verify (sign-in, sensitive action, etc.):

1. Retrieve factor ID from your user model
2. Call SDK method to create challenge for that factor ID
3. **PERSIST THE CHALLENGE ID** for verification step
4. For SMS: message sent automatically
5. For TOTP: user opens authenticator app for current code

Check fetched docs for exact SDK method signature for challenge creation.

## Step 6: Verification Flow

User submits code → call SDK method to verify challenge with:
- Challenge ID (from Step 5)
- Code entered by user

Response structure (check docs for exact field names):
```
{
  "valid": true/false,
  ...
}
```

**Decision tree for verification result:**

```
Verification response?
  |
  +-- valid: true
  |     --> Grant access / complete sign-in
  |     --> Challenge is now consumed (cannot reuse)
  |
  +-- valid: false
  |     --> Show error to user
  |     --> Allow retry with SAME challenge (until expired)
  |
  +-- Error: "challenge already verified"
  |     --> Challenge was used before
  |     --> Must create NEW challenge (go to Step 5)
  |
  +-- Error: "challenge expired"
        --> SMS challenges expire after 10 minutes
        --> Must create NEW challenge (go to Step 5)
```

Check fetched docs for exact SDK method signature for verification.

## Step 7: Sign-In UX Integration

**Existing auth flow modification:**

```
Standard flow:
  Username/password → Grant access

With MFA enabled:
  Username/password → Check if user has MFA factor
    |
    +-- No factor  --> Grant access (MFA not enrolled)
    |
    +-- Has factor --> Redirect to MFA verification screen
                       → Create challenge (Step 5)
                       → Show code input field
                       → Verify code (Step 6)
                       → Grant access if valid
```

**Critical:** The MFA step happens AFTER primary auth succeeds, not before. Do NOT prompt for MFA code before validating username/password.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID

# 2. Check SDK package installed
npm list | grep workos || pip show workos || gem list workos

# 3. Test factor creation (returns factor ID)
# [SDK-specific command to create test factor]

# 4. Test challenge creation (returns challenge ID)
# [SDK-specific command using factor ID from step 3]

# 5. Test verification (returns valid: true/false)
# [SDK-specific command using challenge ID from step 4]
```

**If steps 3-5 fail:** Check fetched docs for current SDK method names and signatures.

## Error Recovery

### "Invalid phone number" (SMS enrollment)

**Cause:** Phone number not in valid format.

**Fix:**
- Use E.164 format: `+[country code][number]` (e.g., `+12025551234`)
- Validate format before calling SDK
- Some regions have specific formatting requirements — check fetched docs

### "Challenge already verified"

**Cause:** Attempting to verify a challenge that was already successfully used.

**Fix:**
1. Do NOT retry with same challenge ID
2. Create NEW challenge (go back to Step 5)
3. Update your flow to prevent double-submission (disable button after first verify)

**Root cause:** Challenges are single-use by design. This prevents replay attacks.

### "Challenge expired" (SMS only)

**Cause:** User took more than 10 minutes to enter code.

**Fix:**
1. Do NOT retry with same challenge ID
2. Create NEW challenge (go back to Step 5)
3. Show "Code expired" message to user
4. Consider adding client-side countdown timer (starts at 10 min)

**Root cause:** SMS codes have expiration to limit attack window.

### "Factor ID not found"

**Cause:** Factor ID from enrollment was not persisted correctly, or user was deleted from your system but factor wasn't cleaned up.

**Fix:**
- Check your user model has factor ID field populated
- Check factor ID format (starts with `auth_factor_`)
- If user re-enrolled: ensure OLD factor ID was replaced, not duplicated

### TOTP codes consistently invalid

**Cause:** Clock skew between server and user's device/authenticator app.

**Fix:**
1. Verify server time is NTP-synced
2. Check authenticator app time settings
3. TOTP allows small time drift — check docs for drift tolerance window
4. If using VM: ensure guest additions are syncing time from host

### Factor creation succeeds but QR code won't scan

**Cause:** QR code data URI rendering issue or base64 corruption.

**Fix:**
1. Verify `qr_code` field is complete base64 string
2. HTML: `<img src="{qr_code}" />` (no additional encoding)
3. If QR won't scan: user can manually enter `secret` field instead
4. Test QR in different authenticator apps (some are more tolerant)

### User locked out (lost device/phone)

**Pattern:** User cannot access authenticator app or SMS phone.

**Recovery options:**
1. Admin portal to disable/reset user's MFA factor
2. Backup codes during enrollment (requires separate implementation)
3. Support ticket flow to verify identity out-of-band

Check fetched docs for factor deletion/management endpoints.

## Architecture Patterns

### Factor ID Storage

**Option 1: User model field (RECOMMENDED)**
```
users table:
  id, email, password_hash, mfa_factor_id
```
Lookup: one query, one factor per user.

**Option 2: Separate factors table**
```
mfa_factors table:
  id, user_id, factor_id, factor_type, created_at
```
Lookup: join required, supports multiple factors per user.

Choose Option 1 unless you need to support multiple MFA methods per user simultaneously.

### Challenge ID Persistence

**Do NOT store challenge IDs in database** — they are short-lived (10 min for SMS).

Store in:
- Session (server-side)
- Encrypted cookie
- Redis/Memcache with TTL

**Trap:** Storing in database creates stale challenge cleanup problem.

### Multi-Factor Support

If user wants BOTH TOTP and SMS:
- Create separate factor for each type
- Store both factor IDs
- At sign-in: let user choose which method to use
- Create challenge for chosen factor type only

### Step-Up Authentication

For sensitive actions (delete account, change email), trigger MFA verification AGAIN even if user already signed in:

1. Check if user has MFA factor
2. If yes: create challenge → verify → proceed
3. If no: proceed without MFA (or require enrollment first)

This is separate from sign-in MFA — same API, different trigger point.

## Related Skills

- workos-authkit-nextjs - For username/password authentication (pairs with MFA)
- workos-authkit-react - For client-side auth flows
