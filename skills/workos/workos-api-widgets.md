---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use this skill when you need to generate short-lived access tokens for WorkOS-hosted UI widgets (e.g., User Management, Organization Settings). The Widgets API is a thin authentication layer — it only handles token generation, not widget configuration or lifecycle. Reach for this when you need to embed WorkOS UI components in your application.

## Key Vocabulary

- **Widget** — a WorkOS-hosted UI component (User Management, Organization Settings, etc.)
- **Widget Token** — short-lived access token scoped to a specific widget and user/organization
- `WORKOS_API_KEY` — server-side credential for token generation
- `/get-token` — the single endpoint for generating widget tokens
- `organization_id` — the WorkOS organization ID for scoping widget access
- `user_id` — the user ID for scoping widget access

## Documentation

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-widgets.guide.md`
