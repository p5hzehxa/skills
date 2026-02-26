<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest widget integration details:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

**Verify before continuing:**

```bash
echo $WORKOS_API_KEY | grep '^sk_' && echo "✓ valid API key" || echo "✗ invalid/missing"
echo $WORKOS_CLIENT_ID | grep '^client_' && echo "✓ valid client ID" || echo "✗ invalid/missing"
```

### SDK Presence

Confirm WorkOS SDK is installed:

```bash
npm list @workos-inc/node 2>/dev/null || echo "FAIL: SDK not installed"
```

## Step 3: Token Generation (CRITICAL)

**All widgets require a secure token.** This token must be generated server-side — NEVER expose API keys to the client.

Create a dedicated API endpoint:

```javascript
// Token generation pattern (server-side only)
const token = await workos.widgets.generateToken({
  userId: currentUser.id,
  organizationId: currentUser.organizationId, // Required for org-scoped widgets
  scopes: ['widgets:user-profile'], // Widget-specific scopes
});
return { token };
```

**Decision tree for scope selection:**

```
Which widget?
  |
  +-- UserProfile --> scopes: ['widgets:user-profile']
  |
  +-- UserSecurity --> scopes: ['widgets:user-security']
  |
  +-- UserSessions --> scopes: ['widgets:user-sessions']
  |
  +-- UserManagement --> scopes: ['widgets:user-management']
  |
  +-- OrganizationSwitcher --> scopes: ['widgets:organization-switcher']
  |
  +-- Multiple widgets --> scopes: [array of all needed scopes]
```

Check fetched docs for complete scope names and token expiry behavior.

## Step 4: Client-Side Integration

### Basic Widget Mounting

Fetch token from your API endpoint, then mount widget:

```javascript
// Fetch token from your server
const response = await fetch('/api/workos-widget-token');
const { token } = await response.json();

// Mount widget with token
workos.widgets.mount({
  element: '#widget-container', // DOM selector
  token: token,
  widget: 'user-profile', // Widget type
});
```

### Widget Type Names (Decision Tree)

```
Widget display goal?
  |
  +-- View/edit profile --> widget: 'user-profile'
  |
  +-- Manage password/MFA --> widget: 'user-security'
  |
  +-- View active sessions --> widget: 'user-sessions'
  |
  +-- Admin user list --> widget: 'user-management'
  |
  +-- Switch organizations --> widget: 'organization-switcher'
```

Check fetched docs for exact widget type strings — they may differ by SDK version.

## Step 5: Pipes Configuration (Advanced)

**Pipes** allow widgets to communicate with your app (e.g., trigger actions when user updates profile).

Define pipe handlers when mounting:

```javascript
workos.widgets.mount({
  element: '#widget-container',
  token: token,
  widget: 'user-profile',
  pipes: {
    onProfileUpdate: (data) => {
      // Handle profile change in your app
      refreshUserData(data.userId);
    },
  },
});
```

Check fetched docs for:

- Available pipe names per widget
- Pipe payload schemas
- Error handling patterns

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Token endpoint exists and returns valid token
curl -s http://localhost:3000/api/workos-widget-token | jq -e '.token' || echo "FAIL: No token endpoint"

# 2. Client code imports widget SDK
grep -r "workos\.widgets" src/ || echo "FAIL: No widget mounting code"

# 3. No API key exposed in client code
grep -r "WORKOS_API_KEY" src/pages src/components 2>/dev/null && echo "FAIL: API key leaked to client" || echo "✓ No key leakage"

# 4. Build succeeds
npm run build
```

## Error Recovery

### "Invalid token" or 401 Unauthorized

**Root cause:** Token expired, missing scopes, or wrong userId.

Fix:

1. Check token generation includes correct `userId` matching the authenticated user
2. Verify scopes array matches widget type (see Step 3 decision tree)
3. Check token hasn't expired — regenerate fresh token for each widget mount

### Widget fails to render / blank container

**Root cause:** Element selector doesn't match DOM, or SDK not loaded.

Fix:

1. Verify element exists before calling `mount()`: `document.querySelector('#widget-container')`
2. Check SDK loaded: `typeof workos !== 'undefined'`
3. Inspect browser console for CORS or network errors

### "organizationId required" error

**Root cause:** Widget needs org context but token generated without it.

Fix:

1. Add `organizationId` to token generation call
2. Ensure user is member of the organization
3. For UserManagement widget, organizationId is MANDATORY

### Widget renders but actions fail (save, delete, etc.)

**Root cause:** Insufficient token scopes.

Fix:

1. Check token scopes match widget requirements exactly (see Step 3)
2. Regenerate token with correct scopes
3. Verify API key has permissions for widget operations in WorkOS Dashboard

## Related Skills

- workos-authkit-react
- workos-authkit-nextjs
- workos-authkit-vanilla-js
