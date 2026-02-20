<!-- refined:sha256:d9fd0f698320 -->

# WorkOS Events API Reference

## When to Use

Use this skill when you need to retrieve audit trail data or monitor system activity across WorkOS features. The Events API provides a paginated stream of events (e.g., `user.created`, `connection.activated`) with filtering by event type, organization, and time range. Reach for this when building compliance dashboards, debugging authentication flows, or triggering downstream workflows based on WorkOS activity.

## Key Vocabulary

- **Event** `event_` — immutable record of a state change in WorkOS (e.g., user creation, SSO activation)
- **Event Type** — structured name like `dsync.user.created`, `sso.connection.activated`, `mfa.factor_enrolled`
- **Organization** `org_` — tenant context for filtering events (links to Directory Sync, SSO, Audit Logs)
- **Pagination** — cursor-based traversal using `before`/`after` parameters and `list_metadata`

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-events.guide.md`
