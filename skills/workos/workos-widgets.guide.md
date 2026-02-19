<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch these URLs:
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

Check for:
- `WORKOS_API_KEY` - starts with `sk_`
- `WORKOS_CLIENT_ID` - starts with `client_`

### Project Type Detection

Determine integration approach based on project structure:

```
Project type?
  |
  +-- Using AuthKit (authkit-js/authkit-react) --> Use access token from AuthKit
  |
  +-- Backend SDK available --> Generate widget tokens via SDK
  |
  +-- Neither --> FAIL: Widget tokens require AuthKit OR backend SDK
```

**Critical:** Widgets require authorization tokens. You cannot use raw API keys directly in frontend code.

## Step 3: Install Widgets Package

Install required packages:

```bash
npm install @workos-inc/widgets @radix-ui/themes @tanstack/react-query
```

**Why peer dependencies:**
- `@radix-ui/themes` - UI component primitives and theming
- `@tanstack/react-query` - Data fetching and caching

These are peer deps (not bundled) to avoid version conflicts if your app already uses them.

**Verify:** All three packages exist in node_modules before continuing.

## Step 4: Widget Selection (Decision Tree)

Choose widgets based on required permissions:

```
What does user need to do?
  |
  +-- View/manage their own sessions --> <UserSessions />
  |                                      Permission: (none required)
  |
  +-- Change password or MFA --> <UserSecurity />
  |                              Permission: (none required)
  |
  +-- Edit their display name --> <UserProfile />
  |                               Permission: (none required)
  |
  +-- Manage org members (invite/remove/roles) --> <UsersManagement />
  |                                                 Permission: widgets:users-table:manage
  |
  +-- Manage Pipes connections --> <Pipes />
  |                                Permission: (check fetched docs)
  |
  +-- Switch between orgs --> <OrganizationSwitcher />
                              Permission: (check fetched docs)
```

**Permission trap:** Most widgets need no special permissions. `<UsersManagement />` is the exception — user's role MUST have `widgets:users-table:manage` or widget will fail to load.

## Step 5: Token Generation Strategy

### If Using AuthKit (Recommended)

AuthKit libraries (`authkit-js`, `authkit-react`) provide access tokens automatically. Pass token directly to widget:

```typescript
import { useAuth } from '@workos-inc/authkit-react';
import { UserSessions } from '@workos-inc/widgets';

function MyComponent() {
  const { accessToken } = useAuth();
  return <UserSessions token={accessToken} />;
}
```

**Verify:** `accessToken` is not null before rendering widget.

### If Using Backend SDK

Generate widget-scoped tokens via SDK "get token" method. Check fetched docs for exact method name per language.

**Token characteristics:**
- Expires after 1 hour
- Scoped to specific widget operations
- Cannot be reused across different widget types (check docs)

**Pattern:**
1. Backend endpoint receives widget request
2. SDK method generates token with appropriate scope
3. Return token to frontend
4. Frontend passes token to widget component

**Do NOT:**
- Generate tokens on page load (wasteful, tokens expire)
- Cache tokens beyond expiration window
- Use same token for multiple widget types (may not work)

## Step 6: Role and Permission Setup

**New WorkOS accounts:** Default "Admin" role has all widget permissions.

**Existing accounts:** Assign permissions via Dashboard → Roles page.

**Critical permission:** `widgets:users-table:manage` required for `<UsersManagement />`.

Check fetched docs for complete permission list per widget.

### Permission Failure Symptoms

- Widget loads blank/empty state
- Console error about insufficient permissions
- User sees "contact admin" message

**Fix:** Go to Dashboard → Roles → [user's role] → add missing permission.

## Step 7: Widget Integration

Wrap widgets in required providers. Check fetched docs for exact provider setup — typically requires:

- `QueryClientProvider` from `@tanstack/react-query`
- `Theme` from `@radix-ui/themes`

**Pattern:**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css'; // REQUIRED

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme>
        {/* Widgets go here */}
      </Theme>
    </QueryClientProvider>
  );
}
```

**Import trap:** Missing `@radix-ui/themes/styles.css` causes unstyled widgets.

## Step 8: Widget-Specific Setup

### UserSessions

Lists active sessions, allows user to sign out remotely.

**No permissions required.** Any authenticated user can use.

### UserSecurity

Password changes, MFA configuration.

**No permissions required.** Any authenticated user can use.

### UserProfile

Display name editing, basic profile info.

**No permissions required.** Any authenticated user can use.

### UsersManagement

Invite/remove org members, change roles.

**Permission required:** `widgets:users-table:manage`

**Admin trap:** Even org admins need explicit permission. Being an "admin" in your app logic ≠ having the WorkOS permission. Check user's role in Dashboard.

### Pipes

Manage third-party integrations.

**Check fetched docs for:** Required permissions, supported integrations.

### OrganizationSwitcher

Switch between user's orgs.

**Check fetched docs for:** Required permissions, multi-org setup requirements.

## Verification Checklist (ALL MUST PASS)

```bash
# 1. Verify packages installed
npm list @workos-inc/widgets @radix-ui/themes @tanstack/react-query

# 2. Check Radix styles imported (grep your entry point)
grep "@radix-ui/themes/styles.css" src/**/*.{ts,tsx,js,jsx}

# 3. Verify env vars set
echo $WORKOS_API_KEY | grep "^sk_" || echo "FAIL: Invalid API key format"

# 4. Build succeeds
npm run build
```

## Error Recovery

### "Widget displays blank/empty"

**Root causes:**
1. Missing permission for that widget
   - Fix: Dashboard → Roles → add permission
   - Verify: Check user's assigned role has the permission
2. Token expired (>1 hour old)
   - Fix: Regenerate token, do not cache long-term
3. Token generated without correct scope
   - Fix: Check SDK method call includes widget-specific scope

### "Cannot read properties of undefined (reading 'token')"

**Root cause:** Trying to render widget before token available.

**Fix:** Conditional rendering:

```typescript
{accessToken && <UserSessions token={accessToken} />}
```

### "Module not found: @radix-ui/themes/styles.css"

**Root cause:** Peer dependency not installed.

**Fix:** `npm install @radix-ui/themes`

### "QueryClient not provided"

**Root cause:** Widget rendered outside `QueryClientProvider`.

**Fix:** Wrap widget tree in provider (see Step 7).

### "User sees 'contact admin' in widget"

**Root cause:** User's role lacks required permission.

**Fix process:**
1. Identify which widget → check permission name in Step 4
2. Dashboard → Users → find user → check assigned role
3. Dashboard → Roles → [that role] → add missing permission
4. User may need to sign out/in for permission to take effect

### Build fails with "Duplicate dependency" error

**Root cause:** Both your app and widgets bundle same peer dependency.

**Fix:** Ensure peer deps installed at root level, not nested:

```bash
npm dedupe @radix-ui/themes @tanstack/react-query
```

## Related Skills

- workos-authkit-react - For token generation via `useAuth()` hook
- workos-authkit-nextjs - For Next.js App Router integration
