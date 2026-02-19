---
name: workos-mfa
description: Add multi-factor authentication to your application.
---

<!-- refined:sha256:ef9462b4b924 -->

# WorkOS Multi-Factor Authentication

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch:
- https://workos.com/docs/mfa/index
- https://workos.com/docs/mfa/example-apps
- https://workos.com/docs/mfa/ux/sign-in
- https://workos.com/docs/mfa/ux/enrollment

These docs are the source of truth. If this skill conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check environment for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify:** Both exist before continuing.

### SDK Installation

Detect package manager, install WorkOS SDK from fetched docs.

**Verify:** SDK package exists in node_modules/vendor directory before continuing.

## Step 3: Architecture Decision (Decision Tree)

MFA API is composable — integrate it into YOUR existing auth flow, not a standalone system.

```
Where in auth flow?
  |
  +-- After primary auth (password/SSO) --> Store factor_id with user record
  |
  +-- Optional step-up auth --> Create challenge on-demand for sensitive actions
  |
  +-- New user enrollment --> Present enrollment UI after account creation
```

**Critical:** MFA API does NOT manage sessions or primary authentication. You handle that.

**SSO users:** Do NOT use this API with WorkOS SSO. Use Identity Provider's native MFA instead.

## Step 4: Factor Type Selection (Decision Tree)

```
User preference?
  |
  +-- Authenticator app (Google Auth, Authy) --> Use factor type: "totp"
  |                                               Response contains qr_code (base64 data URI)
  |                                               Response contains secret (manual entry)
  |
  +-- SMS to mobile device --> Use factor type: "sms"
                               Phone number MUST be valid (E.164 format)
                               Malformed numbers return error immediately
```

Check fetched docs for exact API method signatures and required parameters.

## Step 5: Enrollment Flow (Pseudocode Pattern)

```
1. User initiates enrollment
   → Call SDK method to create authentication factor
   → Method returns: { id, type, qr_code (TOTP), secret (TOTP) }

2. Display enrollment UI
   → If TOTP: render qr_code as image (data URI), show secret for manual entry
   → If SMS: confirm phone number with user

3. User completes setup in their authenticator/receives SMS

4. Create verification challenge
   → Call SDK method with factor_id
   → Method returns: { id, expires_at (SMS only) }

5. User enters code from authenticator/SMS

6. Verify challenge
   → Call SDK method with factor_id and code
   → Method returns: { valid: true/false }

7. Persist factor_id in your user model
   → Critical: Store this ID — you need it for future sign-ins
```

**Do NOT write complete code implementations.** Check fetched docs for exact method names and parameters.

## Step 6: Sign-In Flow (Pseudocode Pattern)

```
1. User enters username/password (YOUR primary auth)

2. Check if user has factor_id in your database
   → If no factor_id: standard sign-in complete
   → If factor_id exists: proceed to MFA verification

3. Create new challenge
   → Call SDK method with stored factor_id
   → Method returns: { id, expires_at (SMS only) }
   → If SMS: user receives text message automatically

4. Display verification UI
   → Show code entry form
   → If SMS: show expiration timer (10 minutes)

5. User enters code

6. Verify challenge
   → Call SDK method with challenge_id and code
   → If valid: true → Complete sign-in, create session
   → If valid: false → Show error, allow retry
```

**Challenge expiration (SMS only):** 10 minutes. After expiration, create new challenge.

**Challenge reuse:** Each challenge is single-use. Never retry same challenge_id — create new challenge instead.

## Step 7: UI Integration Points

### Enrollment Screen

TOTP factors:
- Render `qr_code` value as `<img src="{qr_code}">` (it's a data URI)
- Display `secret` text for manual entry option
- Add code verification input field
- Show "Verify" button

SMS factors:
- Display phone number confirmation
- Add code verification input field
- Show "Verify" button
- Add expiration countdown timer (10 minutes)

### Sign-In Screen

After primary auth succeeds:
- Check user record for `factor_id`
- If present: redirect to MFA verification screen
- Display code entry form
- For SMS: show "Resend code" option (creates new challenge)

Check fetched docs for UX recommendations and example implementations.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check environment variables exist
env | grep WORKOS_API_KEY && env | grep WORKOS_CLIENT_ID || echo "FAIL: Missing env vars"

# 2. Check SDK installed
ls node_modules/@workos-inc 2>/dev/null || ls vendor/workos 2>/dev/null || echo "FAIL: SDK not found"

# 3. Check factor_id persistence in user model
grep -r "factor_id" app/models/ || grep -r "factor_id" src/models/ || echo "WARN: No factor_id in models (check your DB schema)"

# 4. Application builds without errors
npm run build || cargo build || go build || echo "FAIL: Build errors"
```

**If check #3 warns:** Verify you have a database column/field to store factor_id per user. This is required.

## Error Recovery

### "Challenge already verified" error

**Root cause:** Attempted to verify same challenge_id twice.

**Fix:** Create new challenge with factor_id, get new challenge_id, verify that instead.

**Pattern:**
```
❌ Wrong: Retry same challenge_id
✅ Right: New challenge → new challenge_id → verify
```

### "Challenge expired" error (SMS only)

**Root cause:** More than 10 minutes elapsed since challenge creation.

**Fix:** Create new challenge, send new SMS.

**Critical:** TOTP challenges do NOT expire — this only affects SMS.

### "Invalid phone number" error (SMS enrollment)

**Root cause:** Phone number not in E.164 format or invalid.

**Fix:** Validate phone format before SDK call. Must include country code (e.g., +1234567890).

### "Factor not found" error (sign-in)

**Root cause:** factor_id in your database doesn't exist in WorkOS (deleted or never enrolled).

**Fix:** Prompt user to re-enroll, create new factor, update your database.

### "Invalid code" error (verification)

**Root cause:** User entered wrong code OR challenge expired (SMS) OR clock skew (TOTP).

**Fix for TOTP:** Check fetched docs for time window tolerance (usually ±1 period).

**Fix for SMS:** Check if expired, create new challenge if needed.

**UX pattern:** Allow 3-5 retry attempts before rate limiting or requiring new challenge.

### SDK method not found

**Root cause:** Incorrect SDK version or language-specific naming.

**Fix:** Check fetched docs for exact method name in your SDK language. Method names vary (e.g., `createFactor` vs `create_factor`).

## Related Skills

- **workos-authkit-nextjs**: If using AuthKit for primary auth, integrate MFA after initial sign-in
- **workos-authkit-react**: Client-side MFA UI components for React applications
- **workos-sso**: Do NOT combine with MFA API — use IdP's native MFA instead
