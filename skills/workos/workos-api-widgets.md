---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use this skill when you need to generate secure, short-lived tokens for WorkOS-hosted UI widgets (e.g., user profile management, organization settings). The Widgets API is a thin token-generation layer — if you need the full embeddable UI setup or frontend integration patterns, this is your starting point.

## Documentation

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Key Vocabulary

- **Widget Token** — short-lived JWT for authorizing widget iframe loads
- **`WORKOS_API_KEY`** — server-side secret for token generation
- **User ID** — subject of the widget session (who is viewing/editing)
- **Organization ID** — scope of the widget session (which org's data)
- **Token TTL** — expiration time for widget tokens (default: 15 minutes)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-widgets.guide.md`

## Related Skills

- **workos-authkit-react** — for authenticating users before generating widget tokens
- **workos-authkit-nextjs** — for server-side token generation in Next.js API routes
