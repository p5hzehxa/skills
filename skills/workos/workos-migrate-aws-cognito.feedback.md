# Feedback for workos-migrate-aws-cognito

## Corrections

- WorkOS DOES support importing password hashes (bcrypt, scrypt, argon2,
  pbkdf2, ssha, firebase-scrypt) via the Create User and Update User APIs.
  The limitation is on Cognito's side — AWS Cognito does not export password
  hashes or MFA keys. Do NOT write phrasing that conflates the two systems.
- Correct phrasing for Key Vocabulary or guide: "AWS Cognito does not export
  password hashes (Cognito platform limitation). WorkOS supports hash import
  for other providers, but since Cognito won't export them, migrated users
  must reset their password."
- WORKOS_COOKIE_PASSWORD applies to ALL server-side AuthKit framework SDKs
  (Next.js, Remix, React Router, TanStack Start, SvelteKit) — not just
  Next.js. Do not reference it without that context.
- There is NO JIT migration path for Cognito. Cognito does not expose a
  password verification endpoint. The only path is bulk import of user
  attributes + forced password reset (reactive at next login or proactive
  via WorkOS Send Password Reset Email API).

## Emphasis

- Always attribute the hash export limitation to Cognito specifically, not
  to the migration process in general. Use phrasing like "Cognito limitation"
  or "Cognito does not export" to make the source of the constraint clear.
- The migration strategy is: export user attributes via `aws cognito-idp
list-users`, import into WorkOS via Create User API (no password), then
  force password reset for all migrated users.
