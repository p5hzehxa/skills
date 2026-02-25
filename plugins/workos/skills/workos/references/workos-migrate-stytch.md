<!-- refined:sha256:336287048df7 -->

# WorkOS Migration: Stytch

## When to Use

Migrate existing user accounts and organization structures from Stytch to WorkOS while preserving authentication sessions and user identity. Use this when transitioning a production app from Stytch's authentication platform to WorkOS's unified auth system.

## Key Vocabulary

- **User `user_`** — WorkOS user entity created from Stytch user data
- **Organization `org_`** — WorkOS organization mapped from Stytch organization
- **Password Hash Migration** — Stytch exports bcrypt hashes; WorkOS imports them directly
- **Magic Link Migration** — Stytch passwordless users transition to WorkOS email verification
- **Session Migration** — Stytch session tokens cannot be migrated; users must re-authenticate

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `references/workos-migrate-stytch.guide.md`

## Related Skills

- **workos-authkit-react** — implement post-migration auth UI
- **workos-authkit-nextjs** — integrate migrated users into Next.js apps
- **workos-authkit-base** — core auth concepts after migration
