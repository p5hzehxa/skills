# Feedback for workos-migrate-the-standalone-sso-api

## Corrections

- WORKOS_COOKIE_PASSWORD is AuthKit-Next.js specific. Do NOT mention it
  at all — it does not apply to a generic standalone SSO migration guide.
  If session configuration is needed, say "configure session management
  per your framework's AuthKit SDK" and defer to the framework-specific
  AuthKit skill.

## Emphasis

- Use EXACTLY TWO terms consistently throughout: "standalone SSO API"
  for the old system, "AuthKit" for the new system. Do not mix in
  "legacy SSO", "old SSO", or bare "SSO" — pick the two terms and
  stick to them in every heading and paragraph.
