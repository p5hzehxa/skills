# Feedback for workos-migrate-the-standalone-sso-api

## Corrections
- WORKOS_COOKIE_PASSWORD is AuthKit-Next.js specific, not universal.
  Do not reference it without that context.

## Emphasis
- Use clear terminology distinguishing the old standalone SSO API from
  the new AuthKit-based approach (e.g., "standalone SSO", "legacy SSO",
  "old SSO API").
