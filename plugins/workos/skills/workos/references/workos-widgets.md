<!-- refined:sha256:883decb5b1de -->

# WorkOS Widgets

## When to Use

Use this skill when you need to generate secure, short-lived tokens for embedding WorkOS UI components (Admin Portal, Log Streams) directly into your application. Widgets tokens provide scoped access to specific WorkOS resources without requiring full API key management in the frontend.

## Key Vocabulary

- **Widget Token** — short-lived JWT (15-60 minutes) authorizing access to a specific WorkOS UI component
- **Organization `org_`** — the entity whose resources the widget will display (Admin Portal, Log Streams)
- **User `user_`** — optional identifier for tracking which user accessed the widget

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-widgets.guide.md`

## Related Skills

- **workos-admin-portal**: Admin Portal for enterprise management
