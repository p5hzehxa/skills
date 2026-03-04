# Framework: SvelteKit

## Guidance

- Follow existing `+page`, `+layout`, and `+server`/`+page.server` conventions.
- Keep token generation in server/load boundaries that already handle auth/session context.
- For JS/TS token strategy details (AuthKit token vs backend `getToken` with scopes), follow [token-strategies.md](token-strategies.md).
- Keep frontend data calls aligned with current SvelteKit patterns.
- Never embed a widget directly in a `+page.svelte`. Always extract it into its own `.svelte` component file. The page imports and renders that component.

## Server Token Pattern (JS/TS)

Use this pattern when token generation is handled in SvelteKit server boundaries:

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
