<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs in order:
- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The docs are the source of truth for API methods, request/response schemas, and behavioral requirements. This skill provides integration patterns the docs don't cover.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for these secrets before implementation:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist in your secrets manager or `.env` file before continuing.

### Project Requirements

- Existing authentication system with user sessions (WorkOS MFA is composable, not a complete auth solution)
- Database or user store to persist `factor_id` values per user
- SMS provider charges apply if using SMS factors (WorkOS handles delivery)

## Step 3: Factor Type Selection (Decision Tree)

```
What enrollment method does user prefer?
  |
  +-- Authenticator app (Google Authenticator, Authy, 1Password)
  |     --> Use factor type: "totp"
  |     --> Display QR code + secret text fallback
  |     --> No ongoing costs
  |
  +-- SMS text message
        --> Use factor type: "sms"
        --> Requires valid phone number (E.164 format recommended)
        --> WorkOS bills per SMS sent
```

**CRITICAL:** MFA API is NOT compatible with WorkOS SSO. If using SSO, leverage the IdP's MFA instead.

## Step 4: Install SDK

Detect your language/framework and install the WorkOS SDK.

**Verify:** SDK package exists before writing enrollment code.

## Step 5: Factor Enrollment

### TOTP Enrollment Pattern

1. Call SDK method to create TOTP factor (check fetched docs for exact method)
2. Response contains:
   - `id` - the factor_id (PERSIST THIS in your user model)
   - `qr_code` - base64 data URI for QR display
   - `secret` - text fallback for manual entry
3. Display QR code as `<img src="{qr_code}" />` OR provide secret as text
4. User scans with their authenticator app
5. User enters 6-digit code from app to verify enrollment

### SMS Enrollment Pattern

1. Call SDK method to create SMS factor with phone number (check fetched docs for exact method)
2. Phone number validation:
   - Must be valid format (malformed numbers return error immediately)
   - E.164 format recommended: `+14155551234`
3. Response contains `id` - the factor_id (PERSIST THIS in your user model)
4. SMS with code is sent automatically
5. User enters code to verify enrollment

### Critical Data Persistence

**YOU MUST** store the `factor_id` in your user database. The MFA API is stateless - WorkOS does not track which factors belong to which of YOUR users.

```
Recommended schema additions:
- users.mfa_factor_id (string, nullable)
- users.mfa_factor_type (enum: 'totp'|'sms', nullable)
- users.mfa_enrolled_at (timestamp, nullable)
```

## Step 6: Sign-In Flow Modification

### Standard Flow vs. MFA Flow

```
User authentication flow decision:
  |
  +-- User has mfa_factor_id == null
  |     --> Standard sign-in (username + password)
  |     --> Create session immediately
  |
  +-- User has mfa_factor_id != null
        --> Step 1: Validate username + password
        --> Step 2: Create MFA challenge (DO NOT create session yet)
        --> Step 3: Prompt for MFA code
        --> Step 4: Verify challenge
        --> Step 5: Create session only if valid == true
```

**CRITICAL:** Do NOT issue session tokens/cookies until AFTER MFA verification succeeds. This is the whole point of MFA.

### Challenge Creation

After password validation, create a challenge using the user's stored `factor_id`.

For SMS factors: WorkOS sends the SMS automatically when challenge is created.
For TOTP factors: User reads code from their authenticator app.

**Challenge IDs are single-use.** You cannot verify the same challenge twice.

## Step 7: Challenge Verification

User submits their 6-digit code. Verify using SDK method with challenge_id + code.

Response contains `valid` boolean:
- `true` - MFA passed, proceed to create session
- `false` - Code wrong, let user retry (check challenge not expired)

### Retry Logic

Allow 3-5 retry attempts before requiring new challenge creation. This prevents brute force while tolerating typos.

## Verification Checklist (ALL MUST PASS)

Run these checks to confirm integration:

```bash
# 1. Environment secrets exist
env | grep -E "WORKOS_(API_KEY|CLIENT_ID)"

# 2. Database schema includes factor_id column
# (Command varies by DB - check your migration files or schema)

# 3. SDK package installed
# Node: ls node_modules/@workos-inc
# Python: pip show workos
# Ruby: bundle show workos
# Go: go list -m github.com/workos/workos-go

# 4. Test enrollment creates factor_id
# (Make test API call - should return object with 'id' field)

# 5. Test challenge returns challenge_id
# (Create challenge with factor_id - should return object with 'id' field)
```

**If check #2 fails:** Add migration to store factor_id BEFORE enrolling users. You cannot implement MFA without persisting factor associations.

## Error Recovery

### "factor not found" during sign-in challenge

**Root cause:** `factor_id` in your database doesn't exist in WorkOS (user may have been deleted from WorkOS Dashboard).

**Fix:**
1. Clear user's `mfa_factor_id` in your database
2. Force user to re-enroll MFA
3. Consider adding periodic sync job to validate factor_ids

### "challenge already verified" on second verification attempt

**Root cause:** Challenge IDs are single-use. You tried to verify a challenge that already succeeded.

**Fix:** Create a NEW challenge for another verification attempt. Do not reuse challenge_id.

### "challenge expired" for SMS verification

**Root cause:** SMS challenges expire after 10 minutes.

**Fix:**
1. Show user "Code expired" message
2. Offer "Resend code" button that creates NEW challenge (new SMS sent)
3. Consider adding client-side countdown timer showing time remaining

### "invalid phone number" during SMS enrollment

**Root cause:** Phone number format is invalid or malformed.

**Fix:**
1. Validate phone format client-side before API call
2. Require country code: `+1` for US, etc.
3. Strip non-numeric characters except `+`
4. Recommend E.164 format: `+[country][number]`

### "code is invalid" repeatedly with correct code

**Possible causes:**
1. **Clock skew** (TOTP only): Server/client clocks differ by >30 seconds
   - Fix: Sync server clock via NTP
2. **Wrong factor_id**: Using factor_id from different user
   - Fix: Verify factor_id lookup logic in your database query
3. **Expired challenge**: Challenge created >10 min ago (SMS only)
   - Fix: Create new challenge

### User lost authenticator app (TOTP)

**No recovery mechanism in MFA API.** You must implement fallback:

1. Store backup codes during enrollment (generate yourself, store hashed)
2. OR: Store user's phone as SMS fallback factor
3. OR: Require identity verification to clear MFA (support ticket flow)

Do NOT allow admin users to disable MFA for other users without verification - this defeats the security model.

## Integration Patterns

### Enrollment During Onboarding

Add MFA enrollment as optional step after account creation:

1. User completes standard registration
2. Show "Add two-factor authentication" prompt with benefits
3. If user opts in: enrollment flow → persist factor_id
4. If user skips: set `mfa_enrolled_at = null`, allow later enrollment

### Forced Enrollment for Admin Users

For high-privilege accounts, make MFA mandatory:

1. Check if `user.is_admin && user.mfa_factor_id == null`
2. Redirect to enrollment flow on sign-in
3. Block access to admin features until enrollment completes
4. Persist enrollment completion in audit log

### Remember Device (Optional)

To reduce MFA prompts for trusted devices:

1. After successful MFA verification, generate device token (UUID + timestamp)
2. Store `device_token_hash` in user record with 30-day expiry
3. On sign-in, check for valid device token cookie
4. If valid token exists: skip MFA challenge
5. If invalid/missing: require MFA challenge

**Security note:** Device tokens lower security. Only use for non-sensitive apps.

## Related Skills

- workos-authkit-nextjs - Complete auth solution with built-in MFA
- workos-authkit-react - Complete auth solution with built-in MFA

If you need full authentication (not just MFA), AuthKit is simpler than building with MFA API.
