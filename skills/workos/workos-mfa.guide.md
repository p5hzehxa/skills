<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:

- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

These docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or equivalent for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Structure

- Confirm WorkOS SDK is installed before writing code
- Identify user model location (where you'll persist factor IDs)

**Critical:** Do NOT use MFA API with WorkOS SSO. Use the Identity Provider's built-in MFA instead.

## Step 3: Factor Type Selection (Decision Tree)

```
User wants to enroll in MFA?
  |
  +-- Authenticator app (Google Auth, Authy, 1Password)
  |     └─> Use factor type: "totp"
  |         └─> Returns: QR code (base64 data URI) + secret string
  |
  +-- SMS text messages
        └─> Use factor type: "sms"
            └─> Requires: Valid E.164 phone number (+1234567890)
```

**Invalid use case:** WorkOS SSO users. Direct them to IdP's MFA settings instead.

## Step 4: Enrollment Flow

### TOTP Enrollment

1. Call SDK method to create TOTP factor
2. Extract `qr_code` (base64 data URI) and `secret` from response
3. Display QR code as `<img src="{qr_code}">` for user to scan
4. Optionally show `secret` as text for manual entry
5. **CRITICAL:** Persist `factor.id` to your user model BEFORE marking enrollment complete

### SMS Enrollment

1. Call SDK method to create SMS factor with phone number
2. Phone number validation happens server-side — malformed numbers return error
3. **CRITICAL:** Persist `factor.id` to your user model BEFORE marking enrollment complete

**Data model requirement:** Your user table needs a column/field to store factor IDs (string, nullable). One user can have multiple factors.

## Step 5: Challenge Creation

When user attempts sign-in and has enrolled factor(s):

1. Verify username/password (your existing auth)
2. Retrieve factor ID(s) from user model
3. Call SDK method to create challenge for the factor
4. For SMS: WorkOS sends the code automatically
5. For TOTP: User opens their authenticator app
6. Prompt user for code on your sign-in page

**Challenge lifespan:** SMS challenges expire after 10 minutes. TOTP codes rotate every 30 seconds.

## Step 6: Challenge Verification

```
User submits code?
  |
  +-- Call verify challenge with code
  |
  +-- Response: { valid: true/false }
        |
        +-- true  --> Grant session, redirect to app
        |
        +-- false --> Show "Invalid code" error, allow retry
```

**One-time use:** A challenge can only be verified once. If verification fails and user needs to retry, create a NEW challenge.

## Step 7: Sign-In UX Integration

Modify your sign-in flow:

```
Standard flow:
  Username/password → Grant session

MFA-enabled flow:
  Username/password → Check user.factor_id exists?
    |
    +-- No factor  --> Grant session (standard flow)
    |
    +-- Has factor --> Create challenge → Show code prompt → Verify → Grant session
```

**UX trap:** Do NOT create challenge before checking credentials. Verify password FIRST, then trigger MFA.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Check SDK installed
npm list @workos-inc/node || pip show workos || gem list workos

# 2. Check environment variables set
printenv | grep WORKOS_

# 3. Check user model has factor storage
# (Manual: verify your schema has factor_id column/field)

# 4. Test enrollment creates factor
# (Use your app's signup flow or admin panel)

# 5. Test challenge verification with valid code
# (Complete a full sign-in with enrolled factor)
```

**If check #3 fails:** Add factor storage to user model NOW. Enrolling factors without persisting IDs will lock users out.

## Code Example (Language-Agnostic)

```
# Enrollment (TOTP)
factor = workos.mfa.enroll_factor(
  type: "totp"
)
qr_code = factor.qr_code
secret = factor.secret
user.update(mfa_factor_id: factor.id)  # CRITICAL: Persist this

# Sign-In Challenge
challenge = workos.mfa.create_challenge(
  authentication_factor_id: user.mfa_factor_id
)
# For SMS: code sent automatically
# For TOTP: user checks authenticator app

# Verification
result = workos.mfa.verify_challenge(
  authentication_challenge_id: challenge.id,
  code: user_submitted_code
)
if result.valid:
  grant_session(user)
else:
  show_error("Invalid code")
```

Check fetched docs for exact SDK method names in your language.

## Error Recovery

### "Phone number is invalid"

**Cause:** Phone number not in E.164 format.

**Fix:** Validate format before calling SDK: `+[country_code][number]` (e.g., `+14155552671`). No spaces, dashes, or parentheses.

### "Challenge has already been verified"

**Cause:** Attempted to verify same challenge twice.

**Fix:** Create a NEW challenge. Do NOT reuse challenge IDs across attempts.

**Root cause trap:** If your retry logic reuses the same `challenge_id`, it will always fail after first attempt.

### "Challenge has expired" (SMS only)

**Cause:** User submitted code more than 10 minutes after challenge creation.

**Fix:** Create a NEW challenge. Display "Code expired, requesting new code..." message.

**UX consideration:** Auto-create new challenge when user clicks "Resend code" — do NOT prompt them to restart sign-in.

### "Factor ID not found"

**Cause:** Factor was deleted or never persisted to user model.

**Fix:**

1. Check your DB — does `user.mfa_factor_id` exist and match pattern `auth_factor_*`?
2. If missing: User must re-enroll. Redirect to MFA setup flow.
3. If present but invalid: Factor was deleted in WorkOS Dashboard. User must re-enroll.

**Prevention:** Always verify `factor.id` was saved immediately after enrollment.

### Malformed QR code display

**Cause:** `qr_code` field is a base64 data URI — rendering it as text will fail.

**Fix:** Use as `src` attribute directly:

```html
<img src="{factor.qr_code}" alt="Scan with authenticator app" />
```

Do NOT decode or transform the data URI.

## Decision Tree: Multiple Factors per User

```
User has multiple enrolled factors (TOTP + SMS)?
  |
  +-- Let user choose at sign-in
  |     └─> Show buttons: "Use authenticator app" / "Send SMS code"
  |     └─> Create challenge for selected factor only
  |
  +-- Enforce primary factor
  |     └─> Store preferred_factor_id in user model
  |     └─> Create challenge for that factor automatically
  |
  +-- Require both (high security)
        └─> Create challenges for both factors sequentially
        └─> Verify both before granting session
```

Check fetched docs for multi-factor enrollment limits and best practices.

## Related Skills

- workos-authkit-nextjs — For full auth stack with MFA built-in
- workos-authkit-react — Client-side MFA UI components
