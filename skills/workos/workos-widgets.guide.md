<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets — Implementation Guide

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

These docs are the source of truth. If this skill conflicts with fetched docs, follow the docs.

## Step 2: Pre-Flight Validation

### Environment Variables

Check `.env` or `.env.local` for:

- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Dashboard Configuration

Access WorkOS Dashboard → Roles page:

```
Required setup
  |
  +-- Create or verify "Admin" role exists
  |
  +-- Assign widget permissions to role:
      - widgets:users-table:manage (for UsersManagement)
      - Check fetched docs for other widget-specific permissions
```

**Critical:** Widget tokens require user to have a role with appropriate permissions. New accounts have an "Admin" role pre-configured. Existing accounts must assign permissions manually.

## Step 3: Install Dependencies

Detect package manager from lockfile, then install:

```bash
# Required packages
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies:**
- `@radix-ui/themes` - UI components and styling
- `@tanstack/react-query` - Data fetching and caching
- These are peer deps to avoid version conflicts and bundle duplication

**Verify:** All three packages exist in node_modules before continuing.

## Step 4: Framework Detection (Decision Tree)

Read `package.json` to determine React framework:

```
Framework?
  |
  +-- Next.js (App Router) --> Check for app/ directory
  |                           --> Provider setup in layout.tsx
  |
  +-- Next.js (Pages) --> Check for pages/ directory
  |                      --> Provider setup in _app.tsx
  |
  +-- Create React App --> Provider setup in index.tsx or App.tsx
  |
  +-- Vite --> Check vite.config - Provider setup in main.tsx
  |
  +-- Remix --> Check remix.config - Provider setup in root.tsx
```

See https://github.com/workos/widgets-examples for framework-specific patterns.

## Step 5: Provider Setup (REQUIRED)

Wrap your app root with required providers. **ALL THREE are mandatory:**

```tsx
// Pseudocode pattern - check fetched docs for exact imports
import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create QueryClient instance
const queryClient = new QueryClient();

// Wrap app root
<QueryClientProvider client={queryClient}>
  <Theme>
    {/* Your app content */}
  </Theme>
</QueryClientProvider>
```

**Provider order matters:**
1. QueryClientProvider (outermost)
2. Theme
3. Your app components

**Common locations by framework:**
- Next.js App Router: `app/layout.tsx`
- Next.js Pages: `pages/_app.tsx`
- CRA/Vite: `src/App.tsx` or `src/main.tsx`
- Remix: `app/root.tsx`

## Step 6: Token Generation Strategy (Decision Tree)

Choose token acquisition method based on your auth setup:

```
Using AuthKit?
  |
  +-- YES (authkit-js or authkit-react)
  |   --> Use provided access token directly
  |   --> No additional token request needed
  |
  +-- NO (backend SDK only)
      --> Use SDK "get token" method
      --> Request token with widget-specific scope
      --> Token expires after 1 hour
```

**For backend SDK pattern:**

```typescript
// Pseudocode - check SDK docs for exact method name
const token = await workos.getUserManagementToken({
  userId: currentUserId,
  organizationId: currentOrgId,
  scope: 'widgets:users-table:manage' // Widget-specific scope
});
```

**Token expiry handling:** Tokens expire after 1 hour. Implement refresh logic or regenerate on widget mount.

## Step 7: Widget Integration

### Available Widgets

Check fetched docs for current widget list. As of documentation fetch, these widgets exist:

- `<UserSessions />` - Manage active sessions across devices
- `<UserSecurity />` - Password and MFA configuration
- `<UserProfile />` - View and edit display name
- `<UsersManagement />` - Organization admin user management (requires `widgets:users-table:manage` permission)
- `<Pipes />` - Manage third-party connections
- `<OrganizationSwitcher />` - Switch between organizations (check fetched docs for details)

### Integration Pattern

```tsx
// Pseudocode - check fetched docs for exact import paths
import { UsersManagement } from '@workos-inc/widgets';

function MyComponent() {
  const token = getWidgetToken(); // Your token acquisition logic
  
  return (
    <UsersManagement
      token={token}
      // Check fetched docs for other props
    />
  );
}
```

### Permission Requirements

```
Widget Permission Matrix
  |
  +-- UserSessions --> No special permissions
  +-- UserSecurity --> No special permissions
  +-- UserProfile --> No special permissions
  +-- UsersManagement --> Requires widgets:users-table:manage
  +-- Pipes --> Check fetched docs
  +-- OrganizationSwitcher --> Check fetched docs
```

**Critical:** If user lacks required permission, widget will not render or will show permission error. Verify role assignments in Dashboard before debugging widget rendering issues.

## Step 8: Styling Customization (Optional)

Widgets use Radix Themes for styling. To customize:

1. Import Radix Themes CSS in your app root
2. Use Theme component props for global customization
3. Check https://www.radix-ui.com/themes/docs for theme tokens

**Common customization pattern:**

```tsx
<Theme accentColor="blue" grayColor="slate" radius="medium">
  {/* Widgets inherit theme */}
</Theme>
```

## Verification Checklist (ALL MUST PASS)

Run these commands to confirm integration:

```bash
# 1. Check peer dependencies installed
npm list @radix-ui/themes @tanstack/react-query @workos-inc/widgets

# 2. Check provider imports exist (adapt path to your framework)
grep -r "QueryClientProvider\|Theme" src/

# 3. Check widget imports exist
grep -r "@workos-inc/widgets" src/

# 4. Build succeeds
npm run build

# 5. Check role permissions in Dashboard (manual check)
# Navigate to Dashboard → Roles → Verify admin role has widget permissions
```

**If check #1 fails:** Re-run install command from Step 3.

**If check #2 fails:** Go back to Step 5 and add providers.

**If check #4 fails:** Check error output for missing provider or import issues.

## Error Recovery

### "Widget not rendering" or blank screen

**Root cause check sequence:**

1. **Providers missing:** Verify QueryClientProvider and Theme wrap the component
2. **Token issue:** Check token is not null/undefined and hasn't expired (1 hour limit)
3. **Permission issue:** Verify user role has required widget permission in Dashboard
4. **Import path wrong:** Check fetched docs for correct import path (may have changed)

**Fix priority:** Check providers → token → permissions → import path

### "Permission denied" in widget

**Root cause:** User's role lacks the required permission.

**Fix steps:**
1. Go to WorkOS Dashboard → Roles
2. Find user's assigned role
3. Add missing widget permission (e.g., `widgets:users-table:manage` for UsersManagement)
4. Wait ~30 seconds for permission propagation
5. Regenerate widget token with new permissions

**Note:** New accounts have pre-configured Admin role. Existing accounts must manually assign.

### "Token expired" or widget stops working after 1 hour

**Root cause:** Widget tokens expire after 1 hour.

**Fix pattern:**
```typescript
// Implement token refresh on mount or error boundary
useEffect(() => {
  const refreshToken = async () => {
    const newToken = await fetchWidgetToken();
    setToken(newToken);
  };
  
  const interval = setInterval(refreshToken, 50 * 60 * 1000); // Refresh at 50min
  return () => clearInterval(interval);
}, []);
```

### "Peer dependency warning" during install

**Root cause:** Version mismatch or missing peer dependency.

**Fix:** Install exact peer dependencies listed in Step 3. Do not ignore peer dependency warnings — they will cause runtime errors.

### "Cannot find module '@radix-ui/themes'" at runtime

**Root cause:** Radix Themes CSS not imported or peer dependency not installed.

**Fix steps:**
1. Verify `npm list @radix-ui/themes` shows installed package
2. Add CSS import to app root: `import '@radix-ui/themes/styles.css';`
3. Rebuild application

### Build fails with "React not found"

**Root cause:** React version incompatibility or missing React peer dependency.

**Check:** Widgets require React 16.8+ (hooks support). Verify React version in package.json.

## Related Skills

For authentication and token generation patterns:
- workos-authkit-react - Use for client-side token acquisition
- workos-authkit-nextjs - Use for Next.js server-side token generation
- workos-authkit-vanilla-js - Use for non-React implementations
