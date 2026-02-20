<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets — Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs for source of truth:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

If this guide conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Structure

- Confirm `package.json` exists
- Confirm React is installed (widgets require React)

## Step 3: Install Dependencies

Widgets require THREE packages (peer dependencies):

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why three packages:**

- `@workos-inc/widgets` - Widget components
- `@radix-ui/themes` - UI components and styling
- `@tanstack/react-query` - Data fetching/caching

**Verify:** All three packages exist in node_modules before continuing.

## Step 4: Widget Selection (Decision Tree)

Choose widgets based on required functionality:

```
What feature do you need?
  |
  +-- User views their own sessions across devices
  |   --> <UserSessions />
  |
  +-- User manages password + MFA
  |   --> <UserSecurity />
  |
  +-- User edits display name/profile
  |   --> <UserProfile />
  |
  +-- Admin manages org members (invite/remove/change roles)
  |   --> <UsersManagement /> (requires `widgets:users-table:manage` permission)
  |
  +-- User manages third-party connections (integrations)
  |   --> <Pipes />
  |
  +-- User switches between organizations
      --> <OrganizationSwitcher />
```

**CRITICAL:** `<UsersManagement />` requires role with `widgets:users-table:manage` permission. Check WorkOS Dashboard > Roles to verify. Other widgets have NO permission requirements.

## Step 5: Token Generation Strategy (Decision Tree)

Widgets need authorization tokens. Choose strategy based on your auth setup:

```
Using WorkOS AuthKit?
  |
  +-- YES --> Using authkit-js or authkit-react?
  |     |
  |     +-- YES --> Use access token from useAuth() hook
  |     |          (token already has widget scopes)
  |     |
  |     +-- NO  --> Use WorkOS SDK to generate token
  |                 (see Step 6)
  |
  +-- NO  --> Use WorkOS SDK to generate token
              (see Step 6)
```

### Strategy A: AuthKit Libraries

If using `authkit-react`:

```javascript
import { useAuth } from "@workos-inc/authkit-react";

function WidgetPage() {
  const { accessToken } = useAuth();
  return <UserProfile accessToken={accessToken} />;
}
```

Token refresh is automatic. Skip to Step 7.

### Strategy B: Backend SDK Token Generation

Use SDK method for token generation with widget-specific scopes. Check fetched docs for exact method signature per language.

**Token scope mapping:**

- `<UserSessions />` → scope: `widgets:user-sessions:read`
- `<UserSecurity />` → scope: `widgets:user-security:manage`
- `<UserProfile />` → scope: `widgets:user-profile:manage`
- `<UsersManagement />` → scope: `widgets:users-table:manage`
- `<Pipes />` → scope: `widgets:pipes:manage`
- `<OrganizationSwitcher />` → scope: `widgets:organization-switcher:read`

**Token lifespan:** 1 hour. Plan refresh strategy (re-fetch on expiry or use sliding window).

## Step 6: Provider Setup (REQUIRED)

Wrap your app in TWO providers:

```jsx
import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@radix-ui/themes/styles.css";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>{/* Your app with widgets */}</Theme>
    </QueryClientProvider>
  );
}
```

**CRITICAL:** Both providers are required. Missing either causes runtime errors.

**Import order matters:** Import `@radix-ui/themes/styles.css` BEFORE your custom styles to allow overrides.

## Step 7: Widget Integration

Import and render widgets with authorization token:

```jsx
import { UserProfile } from "@workos-inc/widgets";

function ProfilePage({ token }) {
  return <UserProfile accessToken={token} />;
}
```

Check fetched docs for additional props per widget (e.g., `onSuccess`, `onError` callbacks).

## Step 8: Permission Verification (UsersManagement Only)

**If using `<UsersManagement />`:**

1. Navigate to WorkOS Dashboard > Roles
2. Find the role assigned to the user
3. Verify role has `widgets:users-table:manage` permission

**New WorkOS accounts:** "Admin" role has all widget permissions by default.

**Existing accounts:** Assign permissions manually or users will see permission error.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Check all three dependencies installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check providers in app entry point
grep -E "(QueryClientProvider|Theme)" src/App.* src/index.* src/main.* 2>/dev/null

# 3. Build succeeds
npm run build

# 4. Token generation succeeds (run in dev environment)
curl -X POST https://api.workos.com/user_management/widgets/token \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_123","organization_id":"org_123","scope":"widgets:user-profile:manage"}'
```

**If check #4 fails with 403:** User's role lacks required widget permission. Go to Dashboard > Roles.

## Error Recovery

### "Cannot find module '@workos-inc/widgets'"

- Check: All three packages installed (`npm list` command above)
- Check: No typos in import path

### Widget renders but shows "Permission denied"

**Root cause:** User's role lacks the widget's required permission.

**Fix:**

1. Identify widget's required permission (see Step 4 decision tree)
2. Go to WorkOS Dashboard > Roles
3. Edit user's role to add permission
4. Re-generate token with correct scope (tokens cache permissions)

### Token expires mid-session

**Root cause:** Tokens expire after 1 hour. No automatic refresh in SDK strategy.

**Fix:** Implement token refresh:

- Detect 401 responses from widget
- Re-fetch token from backend
- Update widget's `accessToken` prop

### "QueryClient not found in context"

**Root cause:** `QueryClientProvider` missing or widget rendered outside provider tree.

**Fix:**

1. Verify `QueryClientProvider` wraps the component tree containing widgets
2. Check React DevTools component tree - provider must be ancestor of widget

### Styling conflicts with existing CSS

**Root cause:** Radix Theme styles override your app styles or vice versa.

**Fix:**

1. Import `@radix-ui/themes/styles.css` BEFORE custom styles
2. Use CSS specificity or CSS modules to scope your styles
3. Check fetched docs for Radix Theme customization API

### "Invalid scope" error on token generation

**Root cause:** Scope string doesn't match widget requirements.

**Fix:** Use exact scope strings from Step 5 token scope mapping. Check for typos (e.g., `widget` vs `widgets`, `-` vs `_`).

## Related Skills

- workos-authkit-react - For Strategy A token generation
- workos-authkit-nextjs - For Next.js integration patterns
