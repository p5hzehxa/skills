# Framework: React Router

## Guidance

- Follow the repository's route definition style (file-based or config-based).
- Add widget routes/components in the same structure used by existing features.
- Reuse existing loader/action or component-level token patterns.
- For JS/TS token strategy details (AuthKit token vs backend `getToken` with scopes), follow [token-strategies.md](token-strategies.md).
- Preserve current router/provider setup and conventions.

## Server Token Pattern (JS/TS)

Use this pattern when a JS/TS backend or server route generates widget tokens:

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
