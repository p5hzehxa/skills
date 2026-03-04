# Fetching APIs

## Objective

Implement Widgets API calls directly from the bundled OpenAPI spec in a way that matches the host application's data layer.

## Source of Truth

Use [widgets-open-api-spec.yaml](widgets-open-api-spec.yaml) as the source for:

- endpoint paths
- HTTP methods
- request body/query parameters
- response shapes

## Guidance

- Build direct fetch/http client functions from the OpenAPI endpoints.
- Keep request and mutation handling consistent with existing code style.
- If React Query or SWR already exists, use it for query/mutation orchestration on top of the direct endpoint functions.
- Prefer one consistent data pattern per widget flow unless the project already mixes patterns.
- Reuse existing error/loading conventions from the host project.

## Authorization Layer

- Add a small shared request layer that injects authorization consistently for all widget calls.
- Send the widget bearer token in the app's standard authenticated request path.
- Keep authorization wiring close to existing auth/session utilities instead of duplicating token logic across components.
- Handle `401`/`403` responses explicitly and surface clear recovery actions.

## Elevated Access Endpoints

- Some endpoints in the spec are marked as requiring elevated access (notably in sensitive User Profile flows).
- Detect these requirements from endpoint descriptions and response behavior in `widgets-open-api-spec.yaml`.
- Use the `/verify` endpoint flow to obtain an elevated token when needed.
- Pass elevated tokens in header `x-elevated-access-token`.
- Treat elevated tokens as short-lived (10 minutes) and scope them to sensitive operations only that are documented in the open api spec.
