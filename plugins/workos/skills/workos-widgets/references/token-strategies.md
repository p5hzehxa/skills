# Token Strategies

## Objective

Provide `accessToken` to widget surfaces using the app's existing auth architecture.

## Guidance

- Prefer existing AuthKit/session flows when they are already established.
- If AuthKit/WorkOS is not detected, ask the user to run `npx workos@latest install` first, then continue.
- If backend token creation already exists, follow that pattern.
- Keep token-related logic near current auth boundaries.
- Pass token values explicitly into widget entry surfaces.
- Send the widget token through the app's existing authenticated HTTP pattern when calling widget endpoints.
- Use environment variables for credentials/config instead of hardcoded keys.
- For endpoints that require elevated access, follow the elevation flow and handle elevated token usage separately from the regular widget token.

## JS/TS Authorization Tokens

Widgets need an authorization token and JS/TS apps typically use one of two paths:

1. If the app uses `authkit-js` or `authkit-react`, use the existing access token flow.
2. If the app uses a backend WorkOS SDK, request a widget token with `workos.widgets.getToken(...)` and the scopes required by the selected widget(s).

Widget tokens expire after one hour.

```ts
const authToken = await workos.widgets.getToken({
  userId: user.id,
  organizationId,
  // scopes correspond to the permissions needed by each widget
  scopes: ['widgets:users-table:manage', 'widgets:sso:manage'],
});
```

To generate a token successfully, the user needs a role with the required widget permissions. When token generation fails due to authorization, check role permissions in the WorkOS Dashboard roles configuration.

New WorkOS accounts typically start with an Admin role that already has widget permissions. Existing accounts may need explicit role permission updates. Reference: [Roles and Permissions guide](https://workos.com/docs/authkit/roles-and-permissions).

## Elevated Access Tokens

Some operations require elevated access in addition to the normal widget token. When an endpoint indicates elevated access is required:

1. Use the `/verify` endpoint flow in the OpenAPI spec to obtain an elevated access token.
2. Use the returned token (`elevatedAccessToken`) in request header `x-elevated-access-token`.
3. Treat elevated tokens as short-lived credentials (10 minutes) and scope usage to sensitive action paths only.

## Stack-Specific References

- Next.js: [framework-nextjs.md](framework-nextjs.md)
- React Router: [framework-react-router.md](framework-react-router.md)
- TanStack Router: [framework-tanstack-router.md](framework-tanstack-router.md)
- TanStack Start: [framework-tanstack-start.md](framework-tanstack-start.md)
- Vite: [framework-vite.md](framework-vite.md)
- SvelteKit: [framework-sveltekit.md](framework-sveltekit.md)
- Ruby: [framework-ruby.md](framework-ruby.md)
- Python: [framework-python.md](framework-python.md)
- Go: [framework-go.md](framework-go.md)
- PHP: [framework-php.md](framework-php.md)
- Java: [framework-java.md](framework-java.md)

## Example Direction

When backend WorkOS SDK usage is present, use its existing token creation path and adapt it for the required widget scopes.
