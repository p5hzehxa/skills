<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order — they are the source of truth:

1. https://workos.com/docs/mfa/index
2. https://workos.com/docs/mfa/example-apps
3. https://workos.com/docs/mfa/ux/sign-in
4. https://workos.com/docs/mfa/ux/enrollment

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these keys (exact names matter):

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both keys exist and have correct prefixes before continuing.

### SDK Installation

Confirm WorkOS SDK is installed for your language:

```bash
# Node.js
npm list @workos-inc/node || echo "FAIL: SDK not installed"

# Python
pip show workos || echo "FAIL: SDK not installed"

# Ruby
bundle show workos || echo "FAIL: SDK not installed"

# PHP
composer show workos/workos-php || echo "FAIL: SDK not installed"
```

If SDK missing: Check fetched docs for language-specific installation command.

## Step 3: Architecture Planning (Decision Tree)

**Critical distinction:** MFA API is composable — you integrate it into YOUR auth flow. WorkOS does NOT manage sessions or primary authentication.

```
Your auth system architecture?
  |
  +-- Custom auth (username/password in your DB)
  |     --> Integrate MFA as second factor after password check
  |     --> Store factor IDs in your user table
  |
  +-- WorkOS SSO
  |     --> DO NOT USE MFA API (use IdP's native MFA instead)
  |     --> STOP HERE - wrong skill
  |
  +-- Other SSO provider (Auth0, Cognito, etc.)
        --> Integrate MFA as second factor after SSO callback
        --> Store factor IDs alongside SSO identifiers
```

**If using WorkOS SSO:** Stop. The MFA API is not designed for SSO flows. Configure MFA at the Identity Provider level instead.

## Step 4: Data Model Planning

You MUST persist these IDs in your database:

- `user_id` (your primary key)
- `authentication_factor_id` (from WorkOS, starts with `auth_factor_`)
- `authentication_factor_type` (`totp` or `sms`)

**Pattern for user table:**

```
users
  id (your PK)
  email
  password_hash
  mfa_factor_id       (nullable, WorkOS auth_factor_*)
  mfa_factor_type     (nullable, 'totp' or 'sms')
  mfa_enrolled_at     (nullable, timestamp)
```

**CRITICAL:** Do NOT store the TOTP secret or SMS phone number. WorkOS manages these. You only store the factor ID.

## Step 5: Enrollment Flow Implementation

### Factor Type Selection (Decision Point)

```
User chooses MFA method?
  |
  +-- Authenticator app (Google Authenticator, Authy, 1Password)
  |     --> Use type: 'totp'
  |     --> Response includes QR code + secret
  |     --> Display QR code as data URI image
  |
  +-- SMS text message
        --> Use type: 'sms'
        --> Require valid phone number (E.164 format recommended)
        --> WorkOS validates phone number format
```

### Enrollment Steps (Pseudocode Pattern)

**For TOTP:**

```
1. Call SDK method to enroll TOTP factor
   - No parameters needed beyond user context

2. Extract from response:
   - factor.id (save to DB)
   - factor.totp.qr_code (base64 data URI)
   - factor.totp.secret (plaintext backup)

3. Display to user:
   - QR code as <img src="{qr_code}">
   - Secret as copyable text for manual entry

4. Prompt user to enter code from their app

5. Create challenge and verify (see Step 6)

6. If verification succeeds:
   - Save factor.id to user.mfa_factor_id
   - Mark enrollment complete
```

**For SMS:**

```
1. Validate phone number format (E.164 preferred: +1234567890)

2. Call SDK method to enroll SMS factor
   - Pass phone_number parameter

3. Extract factor.id from response (save to DB)

4. WorkOS sends SMS immediately (auto-challenge on enrollment)

5. Prompt user to enter code from SMS

6. Verify challenge (see Step 6)

7. If verification succeeds:
   - Save factor.id to user.mfa_factor_id
   - Mark enrollment complete
```

**Enrollment error handling:**

- Invalid phone → Return user-friendly error, ask to re-enter
- Network error → Show retry option
- Never expose WorkOS error details to user

Check fetched docs for exact SDK method names and parameter shapes.

## Step 6: Challenge Creation and Verification

### Challenge Pattern (Universal for TOTP and SMS)

```
1. Create challenge:
   - Call SDK method with authentication_factor_id
   - Response includes challenge.id

2. For SMS: WorkOS sends code automatically
   For TOTP: User generates code from app

3. Prompt user for code (6-digit number)

4. Verify challenge:
   - Call SDK method with authentication_challenge_id and code
   - Response has valid: true/false

5. Handle response:
   - valid: true  --> Success, grant access
   - valid: false --> Show error, allow retry (but see limits below)
```

**Challenge lifecycle constraints:**

- **SMS challenges expire after 10 minutes** — check fetched docs for current limit
- **Challenges are single-use** — once verified, cannot be reused
- If user needs to retry verification, create NEW challenge

### Verification Response Pattern

The verification response structure:

```
{
  challenge: {
    id: "auth_challenge_...",
    authentication_factor_id: "auth_factor_...",
    valid: true/false
  }
}
```

**Decision tree for verification result:**

```
Verification response?
  |
  +-- valid: true
  |     --> Grant access to protected resource
  |     --> Update last_verified_at timestamp (optional)
  |
  +-- valid: false
        --> Show error: "Invalid code"
        --> Allow retry with SAME challenge (if not expired)
        --> Track retry count (rate limit client-side)
```

Check fetched docs for exact response shape and SDK method signatures.

## Step 7: Sign-In Flow Integration

### Modified Sign-In Sequence

```
Standard auth flow:
  User submits credentials
    |
    v
  Verify password
    |
    v
  Check: user.mfa_factor_id exists?
    |
    +-- No  --> Grant access immediately (no MFA enrolled)
    |
    +-- Yes --> REQUIRE MFA verification before granting access
                  |
                  v
                Create challenge with stored factor ID
                  |
                  v
                Show MFA prompt (different UI for TOTP vs SMS)
                  |
                  v
                Verify code
                  |
                  v
                Grant access only if valid: true
```

**UI considerations:**

- **TOTP users:** Show "Enter code from authenticator app"
- **SMS users:** Show "Enter code sent to ***-***-1234" with masked phone
- Add "Didn't receive code?" option for SMS (creates new challenge)
- Add "Use backup code" option if you implement backup codes (separate feature)

**Session management:**

- Do NOT grant session token until MFA verification succeeds
- Consider short-lived "pending MFA" state if using multi-step forms

## Step 8: Factor Management

### Listing User's Factors

Users may enroll multiple factors (TOTP + SMS for redundancy). Pattern:

```
1. Call SDK method to list factors for user
   - Pass user-scoped query parameter (check fetched docs)

2. Response is array of factor objects

3. Display to user:
   - "Authenticator app" (if type: totp)
   - "SMS: ***-***-1234" (if type: sms, mask phone)
   - Enrolled date

4. Allow user to:
   - Add new factor
   - Remove existing factor (if multiple exist)
   - Test factor (create challenge and verify)
```

### Removing Factors

Before allowing removal:

- Confirm user has at least one other factor, OR
- Warn user they are disabling MFA entirely

Call SDK delete method with `authentication_factor_id`.

**CRITICAL:** Also clear `mfa_factor_id` from your user record.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Environment variables exist
env | grep WORKOS_API_KEY || echo "FAIL: API key missing"
env | grep WORKOS_CLIENT_ID || echo "FAIL: Client ID missing"

# 2. SDK is importable (Node.js example, adapt for your language)
node -e "require('@workos-inc/node')" 2>&1 | grep -q "Error" && echo "FAIL: SDK import failed"

# 3. Database has MFA columns (PostgreSQL example)
psql -d your_db -c "\d users" | grep -q "mfa_factor_id" || echo "FAIL: MFA columns missing"

# 4. Test enrollment endpoint returns factor ID
# (Replace with your actual test command)
curl -X POST http://localhost:3000/api/mfa/enroll -d '{"type":"totp"}' | grep -q "auth_factor_" || echo "FAIL: Enrollment broken"

# 5. Test challenge creation returns challenge ID
curl -X POST http://localhost:3000/api/mfa/challenge -d '{"factor_id":"auth_factor_test"}' | grep -q "auth_challenge_" || echo "FAIL: Challenge creation broken"
```

All checks must pass before marking complete.

## Error Recovery

### "Challenge already verified" Error

**Root cause:** Attempting to verify a challenge that already succeeded.

**Fix:**
1. Create NEW challenge with same `authentication_factor_id`
2. Never reuse challenge IDs
3. Clear challenge ID from session/state after successful verification

### "Challenge expired" Error (SMS only)

**Root cause:** 10 minutes elapsed since challenge creation.

**Fix:**
1. Create NEW challenge (sends new SMS)
2. Show user: "Code expired. We've sent a new code."
3. Do NOT retry with old challenge ID

### "Invalid phone number" Error

**Root cause:** Phone number format rejected by WorkOS.

**Fix:**
1. Validate phone number client-side before sending to API
2. Use E.164 format: `+[country code][number]` (e.g., `+12065551234`)
3. Show user-friendly error: "Please enter phone number with country code"

### "Factor not found" Error

**Root cause:** `authentication_factor_id` in your DB doesn't exist in WorkOS.

**Fix:**
1. Factor was deleted but not removed from your DB
2. Clear `mfa_factor_id` from user record
3. Force user to re-enroll

### SDK Method Not Found

**Root cause:** Mismatch between skill instructions and actual SDK version.

**Fix:**
1. Re-fetch documentation from Step 1
2. Check SDK version: `npm list @workos-inc/node` (or equivalent)
3. Upgrade SDK if outdated
4. Use method signatures from fetched docs, not from this skill

### QR Code Not Displaying

**Root cause:** QR code data URI not rendered as image.

**Fix:**
1. Verify response contains `factor.totp.qr_code` field
2. Use as-is in img tag: `<img src="{qr_code}" />`
3. Data URI format: `data:image/png;base64,iVBORw0KG...`
4. Do NOT decode or transform the string

### Rate Limiting on Verification Attempts

**Pattern:** Implement client-side rate limiting for verification attempts:

```
Track verification attempts per challenge:
  - Allow 5 attempts
  - After 5 failures, force new challenge creation
  - Show: "Too many attempts. Requesting new code."
```

WorkOS does NOT rate limit verification API calls — you must implement this.

## Testing Strategy

### Manual Test Cases

**TOTP enrollment:**
1. Enroll factor → Receive QR code
2. Scan with Google Authenticator
3. Enter code → Verify success
4. Sign out, sign in → Prompt for MFA
5. Enter code → Grant access

**SMS enrollment:**
1. Enroll with phone → Receive SMS immediately
2. Enter code → Verify success
3. Sign out, sign in → Prompt for MFA
4. Request new code → Receive new SMS
5. Enter code → Grant access

**Error cases:**
1. Enter wrong code → Show error
2. Wait 10+ minutes (SMS) → Get expiration error
3. Verify same challenge twice → Get "already verified" error
4. Delete factor → Remove from DB → Force re-enrollment

### Automated Test Pattern

Mock WorkOS SDK responses for these scenarios:
- Successful enrollment
- Failed verification (wrong code)
- Expired challenge
- Already verified challenge

Do NOT call live WorkOS API in CI tests — use mocks or test mode.

## Related Skills

- **workos-authkit-nextjs** — If using WorkOS AuthKit for primary auth (note: AuthKit has built-in MFA)
- **workos-authkit-react** — For client-side auth UI with React

## Migration Notes

### From Auth0 MFA

- Auth0 uses Guardian enrollment flow — WorkOS is simpler (direct factor creation)
- Auth0 auto-creates challenges on enrollment — WorkOS requires explicit challenge creation
- Factor IDs persist across sessions — store them permanently in your user table

### From Cognito MFA

- Cognito ties MFA to user pool — WorkOS is pool-agnostic (you manage user context)
- Cognito TOTP secrets are managed by AWS — WorkOS returns secrets for user backup
- SMS pricing is per-message — check WorkOS pricing for SMS costs

### From Custom TOTP Implementation

- If you were storing TOTP secrets: Delete them, use WorkOS factor IDs instead
- If you were generating QR codes: Use WorkOS QR codes (already base64 data URIs)
- If you were verifying codes locally: Replace with WorkOS verification API (prevents clock skew issues)
