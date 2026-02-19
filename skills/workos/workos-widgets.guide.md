<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs — they are the source of truth:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this guide conflicts with fetched docs, follow docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Type Detection

Identify your integration path:

```
Using AuthKit?
  |
  +-- Yes (authkit-js or authkit-react)
  |     |
  |     +--> Use access token from AuthKit
  |          No additional token generation needed
  |
  +-- No (custom auth or different provider)
        |
        +--> Must generate widget tokens via WorkOS SDK
             Token lifetime: 1 hour
             See Step 4 for generation
```

## Step 3: Install Dependencies

Install widget package and peer dependencies:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies?**
- `@radix-ui/themes` - UI components and styling API
- `@tanstack/react-query` - data fetching and caching

These are peers (not bundled) to avoid version conflicts when your app already uses them.

**Verify:** All three packages exist in `node_modules` before continuing.

## Step 4: Token Generation (Decision Tree)

```
Token source?
  |
  +-- AuthKit integrated
  |     |
  |     +--> Import { useAuth } from '@workos-inc/authkit-react'
  |          Access token available as useAuth().accessToken
  |          No server-side token generation needed
  |
  +-- Custom auth / No AuthKit
        |
        +--> Generate tokens server-side using WorkOS SDK
             Pattern:
             1. Authenticate user (your system)
             2. Call SDK method for token generation with:
                - userId
                - organizationId (for org-scoped widgets)
                - scopes array (see Widget Permissions table below)
             3. Pass token to widget via props
             4. Token expires after 1 hour - regenerate on expiry
```

Check fetched docs for exact SDK method signature - varies by language.

## Step 5: Widget Permissions (CRITICAL)

Each widget requires specific permission scopes. User's assigned role MUST include these:

| Widget               | Required Permission Scope         |
|---------------------|-----------------------------------|
| `<UserSessions />`  | None (all authenticated users)    |
| `<UserSecurity />`  | None (all authenticated users)    |
| `<UserProfile />`   | None (all authenticated users)    |
| `<UsersManagement />`| `widgets:users-table:manage`     |
| `<Pipes />`         | Check fetched docs for scope      |
| `<OrganizationSwitcher />` | Check fetched docs for scope |

**Trap warning:** Token generation will FAIL if user's role lacks the widget's permission. Validate permissions before generating tokens.

### Permission Setup

1. Navigate to WorkOS Dashboard → Roles
2. Create or edit role
3. Assign widget permissions to role
4. Assign role to users who need widget access

**Default for new accounts:** "Admin" role has all widget permissions. Existing accounts must manually assign permissions.

## Step 6: Provider Setup (REQUIRED)

Wrap your app in required providers:

```tsx
// app/layout.tsx or _app.tsx
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@radix-ui/themes/styles.css';

const queryClient = new QueryClient();

export default function RootLayout({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        {children}
      </Theme>
    </QueryClientProvider>
  );
}
```

**Critical:** Both providers are required - `Theme` for styling, `QueryClientProvider` for data fetching.

## Step 7: Widget Integration

Import and render widgets with authorization token:

```tsx
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage({ token }) {
  return <UserProfile authToken={token} />;
}
```

**For AuthKit users:**

```tsx
import { useAuth } from '@workos-inc/authkit-react';
import { UserProfile } from '@workos-inc/widgets';

function ProfilePage() {
  const { accessToken } = useAuth();
  return <UserProfile authToken={accessToken} />;
}
```

Check fetched docs for widget-specific props and customization options.

## Step 8: Organization Context (Multi-Tenant Apps)

For org-scoped widgets (`<UsersManagement />`, `<OrganizationSwitcher />`):

```
Single org per user?
  |
  +-- Yes --> Pass organizationId when generating token
  |
  +-- No (user belongs to multiple orgs)
        |
        +--> Implement org selection UI
        |    Generate new token when user switches orgs
        |    Token is org-scoped - cannot reuse across orgs
```

**Trap warning:** Do NOT generate a single token for multi-org users. Each org context requires a fresh token with that org's ID.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check peer dependencies installed
npm list @radix-ui/themes @tanstack/react-query

# 2. Check providers in layout/root
grep -E "(Theme|QueryClientProvider)" app/layout.tsx _app.tsx 2>/dev/null

# 3. Check Radix CSS imported
grep "@radix-ui/themes/styles.css" -r . --include="*.tsx" --include="*.jsx"

# 4. Build succeeds
npm run build

# 5. Token generation works (if not using AuthKit)
# Run your token generation endpoint - verify it returns a token string
curl -X POST http://localhost:3000/api/widget-token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_123","organizationId":"org_456"}'
```

All checks must pass before marking complete.

## Error Recovery

### "authToken is required"

**Cause:** Widget rendered without token prop or token is undefined.

**Fix:**
1. If using AuthKit: verify `useAuth()` returns `accessToken`
2. If custom auth: verify token generation endpoint is called
3. Check token passed to widget: `console.log({ authToken })` before render

### "User lacks permission for widget"

**Cause:** Token generation failed because user's role doesn't have required permission.

**Fix:**
1. Check user's assigned role in WorkOS Dashboard → Users
2. Check role has widget permission in Dashboard → Roles
3. Assign missing permission to role, or assign user to role with permission

**Prevention:** Add server-side permission check BEFORE attempting token generation:

```
IF user.role.permissions.includes(widgetScope):
  generate token
ELSE:
  return 403 error with helpful message
```

### "QueryClient not provided"

**Cause:** `<QueryClientProvider>` missing from app root.

**Fix:**
1. Verify Step 6 provider setup is complete
2. Check providers wrap ALL widget usage (including nested routes)
3. Do NOT create multiple QueryClient instances - use one at root

### "Theme styles not applied" or blank widgets

**Cause:** `@radix-ui/themes/styles.css` not imported.

**Fix:**
1. Add import to root layout: `import '@radix-ui/themes/styles.css';`
2. Verify import comes BEFORE custom styles (CSS precedence)
3. Check build output includes the CSS file

### Token expired after 1 hour

**Cause:** Widget tokens expire after 60 minutes (by design).

**Fix for AuthKit users:** Access token refreshes automatically - no action needed.

**Fix for custom auth:**
1. Detect 401 error from widget
2. Call token generation endpoint again
3. Update widget's `authToken` prop with new token
4. Consider implementing proactive refresh at 55 minutes

### Widgets not rendering in SSR framework

**Cause:** Widgets are client-side React components.

**Fix:** Add `'use client'` directive to component using widgets (Next.js App Router):

```tsx
'use client';

import { UserProfile } from '@workos-inc/widgets';

export function ProfilePage({ token }) {
  return <UserProfile authToken={token} />;
}
```

For other frameworks, check fetched docs or [Widgets examples repo](https://github.com/workos/widgets-examples) for framework-specific patterns.

## Related Skills

- **workos-authkit-react** - Use AuthKit access tokens for widgets (no separate token generation)
- **workos-authkit-nextjs** - Next.js-specific AuthKit integration with widgets
