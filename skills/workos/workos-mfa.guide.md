<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for latest implementation details:
- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check for required secrets:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify before continuing:**
```bash
# Check env vars are set
env | grep -E 'WORKOS_(API_KEY|CLIENT_ID)' || echo "FAIL: Missing WorkOS credentials"
```

### SDK Installation

Detect project language/framework and install appropriate WorkOS SDK.

**Verify SDK is importable:**
- Node.js: `require('@workos-inc/node')` or `import { WorkOS } from '@workos-inc/node'`
- Python: `import workos`
- Ruby: `require 'workos'`
- Go: `import "github.com/workos/workos-go/v4/pkg/mfa"`

## Step 3: Architecture Decision (Decision Tree)

```
Where is MFA being used?
  |
  +-- With WorkOS SSO
  |     |
  |     +--> STOP: Use IdP's native MFA instead
  |          WorkOS MFA is NOT for SSO flows
  |
  +-- Custom auth system (email/password, magic links, etc.)
        |
        +--> Continue: WorkOS MFA is composable for this
```

**Critical trap:** MFA API is NOT for SSO connections. SSO providers (Okta, Google Workspace, etc.) have their own MFA. WorkOS MFA is for non-SSO auth flows.

## Step 4: Factor Type Selection (Decision Tree)

```
User's MFA preference?
  |
  +-- Authenticator app (Google Authenticator, Authy, 1Password, etc.)
  |     |
  |     +--> Use factor type: "totp"
  |          Response includes QR code (base64 data URI) + secret
  |          User scans QR or manually enters secret
  |
  +-- SMS to mobile device
        |
        +--> Use factor type: "sms"
             Provide phone_number (must be valid E.164 format)
             WorkOS sends OTP via SMS
```

Check fetched docs for SDK method to enroll factor — signature varies by language.

## Step 5: Factor Enrollment Flow

### Enrollment Pattern (All Factor Types)

1. User initiates MFA setup from account settings
2. Call SDK method to enroll factor with type (`totp` or `sms`)
3. Present enrollment UI based on response:
   - TOTP: Display `qr_code` as image + show `secret` as fallback
   - SMS: Display "Code sent to ***-***-1234" message
4. User completes enrollment in authenticator app or receives SMS
5. Create challenge to verify enrollment works
6. User enters code to verify challenge
7. **CRITICAL:** Persist returned `factor.id` in your user model

**Storage requirement:** You MUST save the factor ID to your database. You'll need it for future sign-in challenges.

### Phone Number Validation (SMS Only)

SDK will reject invalid phone numbers. Use E.164 format:
- Valid: `+14155552671`
- Invalid: `4155552671`, `(415) 555-2671`

If validation fails, prompt user to re-enter with country code.

## Step 6: Sign-In Challenge Flow

After user enters password during sign-in:

1. Check your user model: does this user have a factor ID?
2. If yes → create challenge for that factor ID
3. Present verification screen (differs from normal login)
4. User enters code from authenticator app or SMS
5. Verify challenge with entered code
6. If `valid: true` → grant session
7. If `valid: false` → allow retry (show error, don't lock out)

Check fetched docs for challenge creation and verification methods.

### UI Flow Change (IMPORTANT)

Standard login: username → password → session

With MFA: username → password → **MFA code screen** → session

**The MFA screen is an ADDITIONAL step**, not a replacement. User must pass password check first.

## Step 7: Challenge Lifecycle Rules

### Single-Use Constraint

Each challenge can only be verified ONCE. If user enters code incorrectly:
- Do NOT attempt to verify same challenge again
- Create NEW challenge and ask user to generate fresh code

**Pattern:**
```
User enters wrong code
  → Challenge.verify() returns { valid: false }
  → Create NEW challenge
  → Tell user: "Incorrect code. A new code has been sent/generated."
```

### Expiration (SMS Only)

SMS challenges expire after 10 minutes. If expired:
- Do NOT show generic "invalid code" error
- Catch expiration error specifically
- Create NEW challenge automatically
- Tell user: "Code expired. A new code has been sent."

TOTP challenges do not expire (time-based by design).

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check SDK is installed
find . -name "package.json" -exec grep -q "workos" {} \; && echo "PASS: SDK found" || echo "FAIL: SDK not installed"

# 2. Check env vars are set
[ -n "$WORKOS_API_KEY" ] && [ -n "$WORKOS_CLIENT_ID" ] && echo "PASS: Credentials set" || echo "FAIL: Missing credentials"

# 3. Check factor IDs are persisted (adapt query to your DB)
# Example for SQL: SELECT COUNT(*) FROM users WHERE mfa_factor_id IS NOT NULL;
# If no users have factor IDs stored, enrollment flow is incomplete

# 4. Application builds without errors
# Run your language's build/compile command
```

**Do not mark complete until all pass.**

## Error Recovery

### "Phone number is invalid"

**Cause:** SMS factor enrollment with malformed number.

**Fix:**
1. Validate phone number format BEFORE calling SDK
2. Require country code (E.164 format)
3. Show format example: "+14155552671"

### "Challenge was already verified"

**Cause:** Attempting to verify same challenge twice (e.g., on form re-submit).

**Fix:**
1. Track challenge ID in session/state
2. After successful verification, clear challenge ID immediately
3. If user refreshes, create NEW challenge instead of reusing

### "Challenge has expired" (SMS only)

**Cause:** User took >10 minutes to enter code.

**Fix:**
1. Catch error in verification response
2. Create fresh challenge automatically
3. Update UI: "Code expired. New code sent to your phone."

### Verification returns false but no error

**Cause:** User entered incorrect code.

**Fix:**
1. Do NOT create new challenge yet (code might be time-skewed for TOTP)
2. Allow 2-3 retry attempts
3. After 3 failures → create new challenge
4. Show: "Code incorrect. Please try again. (X attempts remaining)"

### Factor ID not found during sign-in

**Cause:** Factor ID wasn't saved after enrollment, or was stored incorrectly.

**Fix:**
1. Check database schema: is factor_id column nullable? Set NOT NULL after users enroll.
2. Verify enrollment flow saves factor ID before redirecting
3. If missing, force user through enrollment again

### QR code not displaying (TOTP)

**Cause:** Response contains `qr_code` as base64 data URI, but UI isn't rendering it.

**Fix:**
1. Check response structure matches docs
2. Render as: `<img src="{qr_code}" alt="Scan with authenticator app" />`
3. Data URI format: `data:image/png;base64,iVBORw0KG...`

### User locked out after MFA errors

**Cause:** Application treating failed MFA like failed password (rate limiting).

**Fix:**
1. MFA failures should NOT count toward account lockout
2. Challenges are single-use — expired/used challenges are expected errors
3. Only lock account on suspicious patterns (e.g., 50+ challenge creations in 1 minute)

## Integration Patterns

### With Existing Session Management

WorkOS MFA is composable — it does NOT manage sessions. After successful verification:

1. Your app creates session (JWT, cookie, etc.) as usual
2. MFA verification is just an additional gate BEFORE session creation
3. Store factor ID with user record, not in session (user needs it on next login)

### With Password Reset

If user has MFA enabled and resets password:

**Decision:** Should password reset require MFA?

- **Yes** → User must verify existing MFA factor before resetting password
- **No** → Password reset disables MFA (user must re-enroll) — add clear warning

Choose based on security requirements. No universal answer.

### With Account Recovery

If user loses access to MFA device:

**You must provide recovery mechanism.** WorkOS MFA API does NOT include recovery codes.

Options:
1. Recovery codes (generate during enrollment, user saves them)
2. Admin override (support team disables MFA after identity verification)
3. Backup SMS factor (enroll TOTP + SMS, either can be used)

Plan this BEFORE launching MFA — locked-out users will contact support.

## Related Skills

- workos-authkit-base — if using WorkOS for primary authentication
- workos-authkit-nextjs — for Next.js projects with AuthKit + MFA
