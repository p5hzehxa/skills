---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use the Widgets API to generate short-lived tokens that authenticate WorkOS hosted UI components (e.g., user profile widgets, organization settings panels). This is a thin API — it only handles token generation for embedding WorkOS UI widgets into your application. If you need to build custom authentication flows or manage user sessions directly, use AuthKit skills instead.

## Documentation

- https://workos.com/docs/reference/widgets
- https://workos.com/docs/reference/widgets/get-token

## Key Vocabulary

- **Widget Token** — short-lived credential for embedding WorkOS UI components
- `/widgets/get-token` endpoint — generates tokens for widget authentication

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-widgets.guide.md`

## Related Skills

- workos-authkit-base — for building custom authentication flows instead of using hosted widgets
