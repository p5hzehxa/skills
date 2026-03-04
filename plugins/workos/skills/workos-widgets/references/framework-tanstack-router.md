# Framework: TanStack Router

## Guidance

- Follow current route module conventions and route tree workflow.
- Place widget route files where the router expects them.
- Keep token retrieval aligned with existing loader/client boundaries.
- For JS/TS token strategy details (AuthKit token vs backend `getToken` with scopes), follow [token-strategies.md](token-strategies.md).
- Reuse existing typing and routing patterns from the project.

## Server Token Pattern (JS/TS)

Use this pattern when token generation lives in JS/TS server handlers/loaders:

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
