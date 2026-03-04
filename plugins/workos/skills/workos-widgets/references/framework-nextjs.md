# Framework: Next.js

## Guidance

- Detect whether the project uses App Router or Pages Router, then follow that structure.
- Place widget routes/pages where existing route modules live.
- Keep token acquisition in the same server/client boundary already used by the app.
- For JS/TS token strategy details (AuthKit token vs backend `getToken` with scopes), follow [token-strategies.md](token-strategies.md).
- Integrate widget components through existing layout and provider patterns.

## Server Token Pattern (JS/TS)

Use this pattern when token generation happens in a Next.js server boundary:

```ts
import { WorkOS } from '@workos-inc/node';

const workos = new WorkOS(process.env.WORKOS_API_KEY as string, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

const { token } = await workos.widgets.getToken({
  organizationId,
  userId,
  scopes: ['widgets:users-table:manage', 'widgets:sso:manage'],
});
```
