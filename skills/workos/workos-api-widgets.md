---
name: workos-api-widgets
description: WorkOS Widgets API endpoints — generate widget tokens and manage widget configuration.
---

<!-- refined:sha256:eda510c1c51f -->

# WorkOS Widgets API Reference

## When to Use

Use this API when you need to generate a secure, expiring token for embedding WorkOS UI components (organization settings, directory sync configuration, audit log viewers) directly into your application. The Widgets API provides a single `/get-token` endpoint that returns a time-limited token your frontend can use to initialize embedded widgets without exposing your API key.

## Key Concepts

**Token Generation Pattern**
- Single endpoint: `POST /widgets/get-token` — creates a short-lived token for widget initialization
- Token scope: bound to a specific user session and widget type
- Token lifespan: expires after a short TTL (check fetched docs for exact duration)
- Frontend usage: token passed to widget initialization script, not stored server-side

**Widget Types and Context**
- Each widget type requires different context parameters in the token request
- Organization widgets: require `organization_id` to scope the UI
- User widgets: require `user_id` to scope the UI
- Check fetched docs for complete list of widget types and their required parameters

**Security Model**
- API key (`WORKOS_API_KEY`) stays server-side — NEVER exposed to frontend
- Generated token is safe to send to frontend (time-limited, scoped)
- Pattern: backend generates token on-demand → frontend initializes widget with token

**ID Prefixes**
- Widget tokens: `widget_token_*`
- Organization IDs: `org_*`
- User IDs: `user_*`

**Common Integration Pattern**
```
1. User navigates to page requiring embedded widget
2. Backend calls /get-token with user/org context
3. Backend returns token to frontend (JSON response or template variable)
4. Frontend passes token to WorkOS widget initialization script
5. Widget loads and displays UI scoped to that user/org
```

**Trap Warning**: Do not cache widget tokens across sessions or users — generate a fresh token for each page load to maintain proper scoping and security.

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-widgets.guide.md`
