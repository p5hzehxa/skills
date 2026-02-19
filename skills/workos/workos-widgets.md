---
name: workos-widgets
description: Embed WorkOS UI widgets in your application.
---

<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs in order. They are the source of truth for widget APIs, permissions, and implementation patterns:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Project Requirements

- Confirm `package.json` exists
- Confirm React is installed (Widgets are React components)
- Check for existing UI library conflicts with Radix Themes

### Environment Variables

Check for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

These are required for backend token generation.

## Step 3: Install Widget Package

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why three packages:**
- `@workos-inc/widgets` - The widget components
- `@radix-ui/themes` - UI framework (peer dependency, prevents duplication)
- `@tanstack/react-query` - Data fetching/caching (peer dependency, prevents duplication)

**Verify installation:**

```bash
ls node_modules/@workos-inc/widgets && echo "PASS" || echo "FAIL: widgets not installed"
ls node_modules/@radix-ui/themes && echo "PASS" || echo "FAIL: radix-ui not installed"
ls node_modules/@tanstack/react-query && echo "PASS" || echo "FAIL: react-query not installed"
```

All three must pass before continuing.

## Step 4: Authorization Token Strategy (Decision Tree)

Widgets require authorization tokens. Choose implementation path:

```
Using AuthKit for auth?
  |
  +-- YES --> Use AuthKit's access token (Step 5A)
  |
  +-- NO  --> Generate tokens via backend SDK (Step 5B)
```

## Step 5A: Token Strategy - AuthKit Integration

If using `authkit-js` or `authkit-react`:

1. The AuthKit access token works directly with Widgets
2. No separate token generation needed
3. Pass the access token to widget `token` prop

**Pattern:**

```typescript
// AuthKit provides the token
import { useAuth } from '@workos-inc/authkit-react';

function MyComponent() {
  const { accessToken } = useAuth();
  return <UserProfile token={accessToken} />;
}
```

**Verify AuthKit integration:**

```bash
grep -r "authkit" package.json && echo "PASS: AuthKit detected" || echo "INFO: Using backend SDK tokens"
```

## Step 5B: Token Strategy - Backend SDK Generation

If NOT using AuthKit, generate widget tokens via backend SDK:

### Backend Endpoint Pattern

Create API route for token generation:

```typescript
// Pseudocode pattern - check fetched docs for exact SDK method
async function generateWidgetToken(userId: string, organizationId: string, scope: string) {
  // SDK method format: workos.widgets.getToken({ ... })
  // Required params: user, organization, scopes array
  // Returns: { token: string } - expires after 1 hour
  
  const token = await sdkMethod({
    user: userId,
    organization: organizationId, 
    scopes: [scope] // e.g., 'widgets:user-profile'
  });
  
  return token;
}
```

**Check fetched docs for:**
- Exact SDK method name and import path
- Required scope strings for each widget type
- Token expiration behavior (1 hour standard)

### Scope Mapping (Reference - Verify in Docs)

Common widget → scope patterns:

- `<UserProfile />` → Scope for profile access
- `<UserSecurity />` → Scope for security settings
- `<UserSessions />` → Scope for session management
- `<UsersManagement />` → Requires `widgets:users-table:manage` permission

**Check fetched docs for complete scope list** - these may change.

### Frontend Token Fetch

```typescript
// Pseudocode - fetch token from your API
async function fetchWidgetToken(widgetType: string) {
  const response = await fetch('/api/widget-token', {
    method: 'POST',
    body: JSON.stringify({ widgetType })
  });
  return response.json(); // { token: string }
}
```

## Step 6: Widget Provider Setup (REQUIRED)

**CRITICAL:** Widgets require TWO provider wrappers.

### 6.1: Radix Theme Provider

Wrap app in `<Theme>` from `@radix-ui/themes`:

```typescript
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css'; // REQUIRED CSS import

function App() {
  return (
    <Theme>
      {/* Your app */}
    </Theme>
  );
}
```

**Do NOT skip the CSS import** - widgets will render unstyled without it.

### 6.2: TanStack Query Provider

Wrap in `<QueryClientProvider>`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <Theme>
      <QueryClientProvider client={queryClient}>
        {/* Your widgets */}
      </QueryClientProvider>
    </Theme>
  );
}
```

**Verify providers:**

```bash
grep -r "Theme" src/ && echo "PASS: Radix Theme found" || echo "FAIL: Theme provider missing"
grep -r "QueryClientProvider" src/ && echo "PASS: Query provider found" || echo "FAIL: Query provider missing"
grep -r "@radix-ui/themes/styles.css" src/ && echo "PASS: Theme CSS imported" || echo "FAIL: CSS import missing"
```

All three must pass.

## Step 7: Implement Widgets (Choose Components)

### Decision Tree: Which Widget?

```
What does user need to do?
  |
  +-- View/edit profile --> <UserProfile token={token} />
  |
  +-- Manage password/MFA --> <UserSecurity token={token} />
  |
  +-- View active sessions --> <UserSessions token={token} />
  |
  +-- Admin: manage org users --> <UsersManagement token={token} organizationId={orgId} />
  |
  +-- Connect third-party accounts --> <Pipes token={token} />
  |
  +-- Switch between orgs --> <OrganizationSwitcher token={token} />
```

### Widget Integration Pattern

```typescript
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage() {
  const token = /* from Step 5A or 5B */;
  
  return (
    <div>
      <UserProfile token={token} />
    </div>
  );
}
```

**Check fetched docs for:**
- Required vs optional props for each widget
- Organization ID requirements (some widgets need `organizationId` prop)
- Event handlers and customization options

## Step 8: Permission Configuration (CRITICAL for UsersManagement)

### Admin Widget Requirements

`<UsersManagement />` requires:

1. User has a role assigned
2. Role includes `widgets:users-table:manage` permission
3. Token scope matches the permission

### Configure in WorkOS Dashboard

```
Navigation path:
Dashboard → Roles → Select role → Permissions → Enable widget permissions
```

**New accounts:** "Admin" role pre-configured with all permissions

**Existing accounts:** Must manually assign permissions to roles

### Verification Command

After dashboard config:

```bash
# User must have role with correct permission
# Check via WorkOS API or dashboard UI
# No automated CLI check available - manual verification required
```

**Test in UI:** Non-admin user should see permission error when accessing `<UsersManagement />`

## Step 9: Framework-Specific Integration

### Decision Tree: Rendering Strategy

```
Framework?
  |
  +-- Next.js App Router --> Client component ('use client' directive)
  |
  +-- Next.js Pages Router --> Standard React component
  |
  +-- Remix --> Client-only route or lazy load
  |
  +-- Vite/CRA --> Standard React component
```

**Critical for Next.js App Router:**

```typescript
'use client'; // REQUIRED at top of file

import { UserProfile } from '@workos-inc/widgets';

export default function ProfilePage() {
  // Widget implementation
}
```

**Why:** Widgets use React hooks (useQuery) which are client-side only.

**Verify Next.js integration:**

```bash
# If using App Router, check for 'use client' directive
find app -name "*.tsx" -exec grep -l "UserProfile\|UserSecurity\|UserSessions" {} \; | xargs grep "use client" && echo "PASS" || echo "WARN: Check if 'use client' needed"
```

## Verification Checklist (ALL MUST PASS)

Run these commands in order:

```bash
# 1. Package installation
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query 2>/dev/null && echo "PASS: Packages installed" || echo "FAIL: Missing packages"

# 2. Provider setup
grep -r "QueryClientProvider" src/ && echo "PASS: Query provider found" || echo "FAIL: Query provider missing"
grep -r "@radix-ui/themes/styles.css" src/ && echo "PASS: Theme CSS imported" || echo "FAIL: CSS import missing"

# 3. Widget imports
grep -r "from '@workos-inc/widgets'" src/ && echo "PASS: Widget imports found" || echo "FAIL: No widget usage detected"

# 4. Environment variables (if using backend tokens)
[ -n "$WORKOS_API_KEY" ] && echo "PASS: API key set" || echo "FAIL: API key missing"

# 5. Build succeeds
npm run build && echo "PASS: Build successful" || echo "FAIL: Build errors"
```

All checks must pass before deployment.

## Error Recovery

### "React is not defined" in Widgets

**Cause:** Missing React import in provider setup file

**Fix:**
```typescript
import React from 'react'; // Add to top of file
import { Theme } from '@radix-ui/themes';
```

### "useQuery is not a function"

**Cause:** TanStack Query provider not wrapping widgets

**Fix:** Verify Step 6.2 - `<QueryClientProvider>` must wrap widget components in tree

### "Invalid token" or 401 errors

**Root cause check:**

1. **Token expired?** Widget tokens expire after 1 hour. Implement refresh logic.
2. **Wrong scope?** Token scope must match widget requirements. Check fetched docs for widget → scope mapping.
3. **Permission missing?** For `<UsersManagement />`, user role must have `widgets:users-table:manage`.

**Debug pattern:**

```typescript
// Log token to verify format
console.log('Token:', token.substring(0, 20) + '...');
// Check token expiration time in your backend logs
```

**Fix:** Regenerate token with correct scope and user permissions.

### "Permission denied" in UsersManagement

**Cause:** User role lacks `widgets:users-table:manage` permission

**Fix:**
1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Enable "Manage users table" permission
4. User must log out and back in for new permissions to apply

### Widgets render unstyled

**Cause:** Missing Radix Themes CSS import

**Fix:** Add `import '@radix-ui/themes/styles.css';` in root layout/app file

**Verify:**

```bash
grep -r "radix-ui/themes/styles.css" src/ || echo "FAIL: Add CSS import"
```

### "Cannot use import statement outside a module" (CommonJS project)

**Cause:** Widgets are ESM-only, project uses CommonJS

**Fix options:**
1. Convert project to ESM (add `"type": "module"` to package.json)
2. Use dynamic imports for widgets: `const Widget = React.lazy(() => import('@workos-inc/widgets'))`

### Next.js: "You're importing a component that needs useState..."

**Cause:** Missing `'use client'` directive in App Router

**Fix:** Add `'use client';` at top of file containing widgets (see Step 9)

### Widget loads but data doesn't appear

**Cause:** Token generation timing issue or invalid organization context

**Debug:**
1. Check browser DevTools Network tab for API calls from widget
2. Verify 200 responses (not 401/403)
3. Check token has correct organization context if widget is organization-scoped

**Check fetched docs for:** Widget-specific data requirements and organization context rules

## Related Skills

- **workos-authkit-react**: For AuthKit integration providing access tokens
- **workos-authkit-nextjs**: For Next.js-specific AuthKit setup with widgets
