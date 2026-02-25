<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify before proceeding:**

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid" || echo "✗ invalid or missing"
```

### SDK Installation

Confirm SDK package exists in project dependencies. Check fetched docs for language-specific package names.

## Step 3: Factor Type Selection (Decision Tree)

```
What authenticator will users use?
  |
  +-- Third-party app (Google Authenticator, Authy, 1Password)
  |     └─> Use factor type: "totp"
  |         Response contains: qr_code (base64 data URI), secret (manual entry fallback)
  |
  +-- SMS to phone number
        └─> Use factor type: "sms"
            Response contains: challenge ID for verification
```

**Critical:** MFA API is NOT compatible with WorkOS SSO. For SSO users, use the IdP's built-in MFA features.

## Step 4: Enrollment Flow

### Create Authentication Factor

Use SDK method for enrolling a factor. Required parameters:

- `type` - from decision tree above ("totp" or "sms")
- `totp_issuer` - your application name (TOTP only, shown in authenticator apps)
- `totp_user` - user identifier (TOTP only, shown in authenticator apps)
- `phone_number` - E.164 format (SMS only)

**Example pattern (language-agnostic):**

```
factor = workos.mfa.enrollFactor({
  type: "totp",
  totp_issuer: "YourApp",
  totp_user: user.email
})

// For TOTP: Display factor.qr_code as image src
// Alternative: Show factor.secret for manual entry
// For SMS: Challenge sent automatically
```

### Store Factor ID

**CRITICAL:** Persist `factor.id` in your user database. This ID is required for all future authentication challenges. Without it, the factor cannot be used.

## Step 5: Challenge Creation

When user attempts sign-in, create a verification challenge:

```
challenge = workos.mfa.createChallenge({
  authentication_factor_id: stored_factor_id
})

// For SMS: OTP sent to phone
// For TOTP: User opens authenticator app
```

Challenge IDs are single-use. After successful verification, create a new challenge for next authentication.

## Step 6: Verify Challenge

User submits code from authenticator app or SMS:

```
verification = workos.mfa.verifyChallenge({
  challenge_id: challenge.id,
  code: user_submitted_code
})

if (verification.valid) {
  // Grant session access
}
```

Check fetched docs for exact response schema and session integration patterns.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check environment variables set
grep -E '^WORKOS_API_KEY|^WORKOS_CLIENT_ID' .env || echo "FAIL: Missing env vars"

# 2. Verify SDK imported (adjust path for your language)
grep -r "workos.*mfa" src/ || echo "FAIL: No MFA implementation found"

# 3. Check factor ID persistence (search for database/storage logic)
grep -r "factor.id\|factor_id\|authentication_factor_id" src/ || echo "FAIL: No factor storage found"

# 4. Build succeeds
npm run build # or equivalent for your language
```

## Error Recovery

### "challenge already verified"

**Cause:** Attempting to verify a challenge twice.

**Fix:** Challenges are single-use. Create a new challenge for each authentication attempt:

```
// WRONG: Reusing challenge.id across multiple attempts
// CORRECT: Call createChallenge() each time user signs in
```

### "challenge expired" (SMS only)

**Cause:** SMS challenges expire after 10 minutes.

**Fix:**

1. Check user submitted code within 10-minute window
2. If expired, create new challenge and resend SMS
3. Consider adding countdown timer in UI to indicate expiration

### "invalid code"

**Causes:**

- User typo in OTP entry
- Clock skew for TOTP (user device time incorrect)
- SMS code not yet delivered

**Fix:**

1. For TOTP: Advise user to check device time sync settings
2. For SMS: Wait 30s and allow resend via new challenge
3. Limit verification attempts to prevent brute force (implement rate limiting)

### QR code not displaying (TOTP)

**Cause:** `qr_code` value is a data URI, not a URL.

**Fix:** Use as image src directly without fetching:

```
// CORRECT:
<img src={factor.qr_code} />

// WRONG:
fetch(factor.qr_code) // qr_code is already encoded data
```

### Factor creation returns 400

**Cause:** Invalid phone number format (SMS) or missing issuer/user (TOTP).

**Fix:**

- SMS: Ensure phone number in E.164 format (+1234567890, not (123) 456-7890)
- TOTP: Include both `totp_issuer` and `totp_user` parameters

## Integration Patterns

### Session Management

MFA verification confirms factor ownership — NOT user identity. Pattern:

1. User provides primary credential (password, email link)
2. System identifies user and retrieves stored `factor_id`
3. Create challenge, user submits code
4. On successful verification, grant session token

**Do NOT** use MFA as primary authentication. It supplements existing auth.

### Multi-Device Support

Each device needs separate enrollment:

- Store array of `factor_id` values per user
- During challenge, let user choose which device/method
- Implement "trust this device" to skip MFA on known devices

Check fetched docs for user management best practices.
