<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use this skill when you need to generate secure, short-lived tokens for embedded WorkOS UI components (widgets). The Widgets API provides a single endpoint (`/get-token`) that creates tokens scoped to specific widget types and contexts, allowing you to embed WorkOS functionality directly in your application's interface without building custom UI.

## Key Vocabulary

- **Widget Token** — short-lived JWT that authorizes a specific widget instance
- **Widget Type** — identifier for the embedded component (e.g., `user_management`, `organization_switcher`)
- **Scope Context** — parameters that limit what the widget can access (organization ID, user ID, etc.)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-widgets.guide.md`
