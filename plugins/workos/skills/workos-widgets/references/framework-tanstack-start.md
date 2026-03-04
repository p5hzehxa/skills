# Framework: TanStack Start

## Guidance

- Follow established Start route/file conventions.
- Keep server/client boundaries consistent with existing auth and data flows.
- Add widget integration with minimal structural changes.
- For JS/TS token strategy details (AuthKit token vs backend `getToken` with scopes), follow [token-strategies.md](token-strategies.md).
- Reuse current route and module organization patterns.

## Server Token Pattern (JS/TS)

Use this pattern when token generation is handled in Start server boundaries:

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
