---
name: workos-api-authkit
description: WorkOS AuthKit API endpoints — users, sessions, authentication, MFA, and organization memberships.
---

<!-- refined:sha256:5f44c1949409 -->

# WorkOS AuthKit API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/authkit
- https://workos.com/docs/reference/authkit/api-keys
- https://workos.com/docs/reference/authkit/api-keys/create-for-organization
- https://workos.com/docs/reference/authkit/api-keys/delete
- https://workos.com/docs/reference/authkit/api-keys/list-for-organization
- https://workos.com/docs/reference/authkit/api-keys/validate
- https://workos.com/docs/reference/authkit/authentication
- https://workos.com/docs/reference/authkit/authentication-errors

## Authentication Setup

Set your API key in the environment:

```bash
export WORKOS_API_KEY=sk_live_abc123...
export WORKOS_CLIENT_ID=client_abc123...
```

All API requests require the `Authorization: Bearer $WORKOS_API_KEY` header. Verify your setup:

```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 OK with user list. If 401: check API key format (must start with `sk_`).

## Endpoint Catalog

### Authentication Flow Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/authorize` | Generate authorization URL for OAuth flow |
| POST | `/user_management/authenticate` | Exchange authorization code for session |
| POST | `/user_management/sessions/refresh` | Refresh an expired session |
| GET | `/user_management/sessions/{session_id}` | Get session details |
| POST | `/user_management/sessions/{session_id}/revoke` | Revoke active session |

### User Management Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/users` | List all users |
| GET | `/user_management/users/{user_id}` | Get user by ID |
| GET | `/user_management/users/by-external-id/{external_id}` | Get user by external ID |
| POST | `/user_management/users` | Create new user |
| PUT | `/user_management/users/{user_id}` | Update user |
| DELETE | `/user_management/users/{user_id}` | Delete user |

### Organization Membership Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/organization_memberships` | List memberships |
| GET | `/user_management/organization_memberships/{membership_id}` | Get membership by ID |
| POST | `/user_management/organization_memberships` | Create membership |
| PUT | `/user_management/organization_memberships/{membership_id}` | Update membership role |
| DELETE | `/user_management/organization_memberships/{membership_id}` | Remove membership |
| POST | `/user_management/organization_memberships/{membership_id}/deactivate` | Deactivate membership |
| POST | `/user_management/organization_memberships/{membership_id}/reactivate` | Reactivate membership |

### Invitation Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/invitations` | List invitations |
| GET | `/user_management/invitations/{invitation_id}` | Get invitation by ID |
| POST | `/user_management/invitations` | Send invitation |
| POST | `/user_management/invitations/{invitation_id}/revoke` | Revoke invitation |
| POST | `/user_management/invitations/{invitation_id}/resend` | Resend invitation |

### MFA Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/user_management/authentication_factors` | List user's MFA factors |
| POST | `/user_management/authentication_factors/enroll` | Enroll new MFA factor |

### Magic Auth Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/magic_auth/send` | Send magic link email |
| GET | `/user_management/magic_auth/{magic_auth_id}` | Get magic auth status |

### Password Reset Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/password_reset/send` | Send password reset email |
| GET | `/user_management/password_reset/{reset_id}` | Get reset status |
| POST | `/user_management/password_reset/confirm` | Complete password reset |

### Email Verification Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/user_management/email_verification/send` | Send verification email |
| GET | `/user_management/email_verification/{verification_id}` | Get verification status |

## Operation Decision Tree

### User Creation vs Update vs Membership

**Create user without organization:**
```
POST /user_management/users
{
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe"
}
```

**Create user WITH organization (requires two calls):**
```
1. POST /user_management/users (as above)
2. POST /user_management/organization_memberships
   {
     "user_id": "user_abc123",
     "organization_id": "org_abc123",
     "role_slug": "member"
   }
```

**Update existing user:**
```
PUT /user_management/users/{user_id}
{
  "first_name": "Jane",
  "last_name": "Smith"
}
```

**Change organization role:**
```
PUT /user_management/organization_memberships/{membership_id}
{
  "role_slug": "admin"
}
```

### Invitation vs Direct Membership

**Use invitations when:**
- User doesn't exist yet in WorkOS
- User needs to accept terms/set password
- You want email verification

**Use direct membership when:**
- User already exists in WorkOS
- Programmatic access assignment
- Migrating existing users

### Session Refresh vs Re-authentication

**Refresh session (user_id stays same):**
```
POST /user_management/sessions/refresh
{
  "refresh_token": "refresh_abc123..."
}
```

**Re-authenticate (new session):**
```
POST /user_management/authenticate
{
  "code": "auth_code_abc123...",
  "code_verifier": "pkce_verifier..."
}
```

## Error Code Mapping

Check fetched docs for complete error code list. Common patterns:

### 401 Unauthorized
**Cause:** Invalid or missing API key  
**Fix:** Verify `Authorization: Bearer sk_...` header format

### 404 Not Found
**Cause:** Resource ID doesn't exist or wrong endpoint path  
**Fix:** Verify ID format matches resource type (user_abc, org_abc, etc.)

### 422 Unprocessable Entity
**Cause:** Invalid request parameters or constraint violation  
**Fix:** Check response body for field-specific validation errors

### 429 Too Many Requests
**Cause:** Rate limit exceeded  
**Fix:** Implement exponential backoff with 60-second base retry

### Authentication Flow Errors

AuthKit returns structured error codes in the `error` query parameter during OAuth callback. Check fetched docs for:
- `email_verification_required`
- `mfa_enrollment`
- `mfa_challenge`
- `organization_selection_required`
- `sso_required`

Handle these by redirecting user to appropriate UI:
```
if (error === 'mfa_enrollment') {
  redirect to MFA setup flow
} else if (error === 'email_verification_required') {
  redirect to email verification UI
}
```

## Pagination Handling

List endpoints support pagination with `before`, `after`, and `limit` parameters:

```bash
# First page
curl "https://api.workos.com/user_management/users?limit=10" \
  -H "Authorization: Bearer $WORKOS_API_KEY"

# Next page using cursor from response
curl "https://api.workos.com/user_management/users?limit=10&after=user_xyz" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Response includes `list_metadata` with `before` and `after` cursors. Continue until `after` is null.

SDK pattern (pseudocode):
```
all_users = []
after_cursor = None

while True:
  response = sdk.list_users(limit=100, after=after_cursor)
  all_users.extend(response.data)
  
  if not response.list_metadata.after:
    break
  after_cursor = response.list_metadata.after
```

## Rate Limits

Check fetched docs for current rate limits. General guidance:
- Implement exponential backoff for 429 responses
- Cache session data instead of re-fetching user on every request
- Use webhooks for state changes instead of polling

## Runnable Verification

### Verify API Key
```bash
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```
Expected: 200 with user list or empty array

### Create Test User
```bash
curl -X POST https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "email_verified": true,
    "first_name": "Test",
    "last_name": "User"
  }'
```
Expected: 201 with user object containing `id` field starting with `user_`

### List Organizations
```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```
Expected: 200 with organization list

### Generate Authorization URL (via SDK)
```javascript
const authorizationUrl = workos.userManagement.getAuthorizationUrl({
  provider: 'authkit',
  redirectUri: 'https://yourapp.com/callback',
  clientId: process.env.WORKOS_CLIENT_ID,
});
```
Expected: URL string starting with `https://api.workos.com/user_management/authorize?`

## Related Skills

- **workos-authkit-nextjs** — AuthKit integration for Next.js applications
- **workos-authkit-react** — AuthKit integration for React applications
- **workos-authkit-vanilla-js** — AuthKit integration for vanilla JavaScript
