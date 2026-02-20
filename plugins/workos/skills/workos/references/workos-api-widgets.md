<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use the Widgets API when you need to generate time-limited access tokens for embedding WorkOS UI components (like User Management or Directory Sync configuration screens) directly into your application. This API provides a secure way to delegate user interface rendering to WorkOS-hosted widgets without exposing sensitive API credentials to the browser.

## Key Vocabulary

- **Widget Token** — Short-lived JWT returned by `/get-token`, used to authenticate widget sessions
- **Session Duration** — Token validity period, specified in seconds during token generation
- **Widget Scope** — Determines which UI component the token grants access to (e.g., user management, directory sync)

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-api-widgets.guide.md`
