<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets Implementation Guide

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these docs for latest implementation details:

- https://workos.com/docs/widgets/user-sessions
- https://workos.com/docs/widgets/user-security
- https://workos.com/docs/widgets/user-profile
- https://workos.com/docs/widgets/user-management
- https://workos.com/docs/widgets/tokens
- https://workos.com/docs/widgets/quick-start
- https://workos.com/docs/widgets/pipes
- https://workos.com/docs/widgets/organization-switcher

These docs are the source of truth. If this skill conflicts with them, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Structure

- Confirm `package.json` exists (React project)
- Confirm React version 16.8+ (hooks required)

## Step 3: Install Widget Package

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Verify:** All three packages exist in `node_modules` before continuing.

**Why peer dependencies:** Radix Themes and TanStack Query are commonly used libraries. Peer dependency pattern avoids version conflicts and bundle bloat.

## Step 4: Token Acquisition (Decision Tree)

Widgets require authorization tokens with specific scopes. Choose token source:

```
Using AuthKit SDK?
  |
  +-- YES --> Use access token from authkit-js or authkit-react
  |           (token automatically includes required scopes)
  |
  +-- NO  --> Use backend SDK "get token" method
              (specify widget scope explicitly)
```

**Token properties:**
- Expires after 1 hour
- Scope determines which widgets user can access
- User must have role with matching permissions

### Permission Requirements by Widget

Check fetched docs for complete permission list. Common mappings:

- `<UserSessions />` - No special permissions required
- `<UserSecurity />` - No special permissions required  
- `<UserProfile />` - No special permissions required
- `<UsersManagement />` - Requires `widgets:users-table:manage` permission
- `<Pipes />` - Check fetched docs for exact scope
- `<OrganizationSwitcher />` - Check fetched docs for exact scope

**Critical:** New WorkOS accounts have "Admin" role with all permissions. Existing accounts must assign permissions via Dashboard → Roles page.

## Step 5: Provider Setup (REQUIRED)

Widgets depend on Radix Themes and TanStack Query providers. Wrap your app:

```tsx
// App root component
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@radix-ui/themes/styles.css';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        {/* Your app content and widgets here */}
      </Theme>
    </QueryClientProvider>
  );
}
```

**Critical:** This wrapper is REQUIRED. Widgets will fail at runtime without both providers.

**Import order matters:** Import Radix Themes CSS before your custom styles to allow overrides.

## Step 6: Widget Integration

### Basic Pattern

All widgets follow this pattern:

```tsx
import { WidgetName } from '@workos-inc/widgets';

function MyComponent({ token }) {
  return <WidgetName token={token} />;
}
```

Replace `WidgetName` with specific widget component. Check fetched docs for:
- Exact import paths (may be subpath exports)
- Additional props beyond `token`
- Styling customization options via Radix Themes

### Token Passing Pattern

```
Server-rendered?
  |
  +-- YES --> Fetch token server-side, pass as prop to widget component
  |
  +-- NO  --> Fetch token client-side (useEffect or data fetching library)
```

**Never:** Hardcode tokens in frontend code.

## Step 7: Role and Permission Setup

### For New WorkOS Accounts

Default "Admin" role has all widget permissions. No action needed.

### For Existing WorkOS Accounts

1. Navigate to WorkOS Dashboard → Roles page
2. Select or create role for widget access
3. Assign required permissions (see Step 4 for permission names)
4. Assign role to users who need widget access

**Trap warning:** Token generation will succeed even if user lacks permissions. Widget will fail at render time with permission error.

**Verification:** Test with a non-admin user to confirm permission checks work.

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check widget package installed
npm list @workos-inc/widgets 2>/dev/null | grep @workos-inc/widgets

# 2. Check peer dependencies installed
npm list @radix-ui/themes @tanstack/react-query 2>/dev/null | grep -E "@radix-ui/themes|@tanstack/react-query"

# 3. Check Radix CSS import exists (find any .tsx/.jsx/.ts/.js file)
grep -r "@radix-ui/themes/styles.css" --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" . 2>/dev/null

# 4. Check QueryClientProvider wrapper exists
grep -r "QueryClientProvider" --include="*.tsx" --include="*.jsx" . 2>/dev/null

# 5. Application builds
npm run build
```

**If check #3 or #4 fails:** Go back to Step 5 and add providers. Widgets will not work without them.

## Error Recovery

### "Cannot read properties of undefined" at runtime

**Most common cause:** Missing provider wrapper (QueryClientProvider or Theme).

Fix:
1. Verify both providers wrap widget component in component tree
2. Check provider import paths are correct
3. Verify Radix Themes CSS is imported

### Token generation succeeds but widget shows "Permission denied"

**Root cause:** User role lacks required permission for widget.

Fix:
1. Check fetched docs for exact permission name (format: `widgets:{widget-name}:{action}`)
2. Navigate to Dashboard → Roles
3. Assign permission to user's role
4. User must re-authenticate to get updated permissions

### "Module not found" for @workos-inc/widgets

**Root cause:** Package not installed or wrong import path.

Fix:
1. Verify package exists: `npm list @workos-inc/widgets`
2. Check fetched docs for correct import path (may be subpath export like `@workos-inc/widgets/user-sessions`)
3. Clear node_modules and reinstall if corruption suspected

### Widget renders but data doesn't load

**Root cause:** Token expired (1 hour lifetime) or invalid scope.

Fix:
1. Implement token refresh logic (re-fetch from backend before expiry)
2. Verify token includes correct scope for widget (check backend SDK token generation)
3. Inspect network requests in browser DevTools for 401/403 responses

### Styling conflicts with Radix Themes

**Root cause:** CSS specificity or import order issue.

Fix:
1. Import Radix Themes CSS BEFORE custom styles
2. Use Radix Themes customization API instead of overriding CSS directly
3. Check fetched docs for theme customization options

### Peer dependency version conflicts

**Root cause:** Existing app uses incompatible version of Radix Themes or TanStack Query.

Fix:
1. Check `package.json` for version ranges that satisfy both app and widgets
2. Use npm/yarn/pnpm resolution features to force compatible version
3. Test thoroughly - peer dependency conflicts can cause subtle runtime issues

## Related Skills

- workos-authkit-react - For obtaining access tokens automatically
- workos-authkit-nextjs - For server-side token generation in Next.js
