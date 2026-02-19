# Feedback for workos-migrate-aws-cognito

## Corrections
- WorkOS DOES support importing password hashes. The limitation is on
  Cognito's export side — Cognito doesn't export password hashes. Do not
  claim "WorkOS does NOT support importing password hashes" or "WorkOS
  cannot import passwords."
- WORKOS_COOKIE_PASSWORD is AuthKit-Next.js specific, not universal for
  Cognito migration. Do not reference it without that context.

## Emphasis
- Clearly distinguish Cognito limitations from WorkOS limitations when
  discussing password hash migration.
