<!-- refined:sha256:3b6983312415 -->

# WorkOS Migration: Better Auth

## When to Use

Use this skill when migrating an existing Better Auth implementation to WorkOS AuthKit. Better Auth is a TypeScript-first authentication library — this guide helps you preserve user identities, session state, and organization mappings during the transition.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Better Auth user records
- **Organization `org_`** — WorkOS organization entity mapped from Better Auth organization data
- **Password Hash** — bcrypt hashes exported from Better Auth's user table
- **Session Migration** — process of transferring active Better Auth sessions to WorkOS

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-better-auth.guide.md`
