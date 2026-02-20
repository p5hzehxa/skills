# Feedback for workos-migrate-the-standalone-sso-api

## Corrections

- Use EXACTLY TWO terms throughout the ENTIRE guide, including verification
  commands, error recovery sections, and code patterns: "standalone SSO API"
  for the old system, "AuthKit" for the new system. Do NOT use bare "SSO",
  "SSO API", "old SSO", or "legacy SSO" anywhere — not in headings, not in
  paragraphs, not in bash grep patterns, not in error descriptions. If
  referring to SDK methods like `sso.getAuthorizationUrl()`, clarify with
  "standalone SSO API method" on first mention.
- WORKOS_COOKIE_PASSWORD applies to ALL server-side AuthKit framework SDKs
  (Next.js, Remix, React Router, TanStack Start, SvelteKit) — not just
  Next.js. Do NOT mention it in this generic migration guide. If session
  configuration is needed, say "configure session management per your
  framework's AuthKit SDK" and defer to the framework-specific AuthKit skill.

## Emphasis

- The official WorkOS docs use "standalone SSO API" as the full term and
  sometimes shorten to "SSO API" in code comparisons. For this guide,
  always use the full "standalone SSO API" to avoid ambiguity.
