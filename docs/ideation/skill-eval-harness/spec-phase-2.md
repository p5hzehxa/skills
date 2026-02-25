# Implementation Spec: Skill Eval Harness - Phase 2

**Contract**: ./contract.md
**Depends on**: Phase 1 (all infrastructure)
**Estimated Effort**: M

## Technical Approach

Phase 2 writes the YAML test cases for the top 5 products (SSO, AuthKit/Next.js, Directory Sync, Audit Logs, RBAC), runs the first eval, and calibrates scoring weights based on actual results. This is where the harness produces its first real data.

Test cases are written against the actual WorkOS Node.js SDK documentation. Each case needs accurate `expected` signals — real method names, real env vars, real parameter names. Getting these wrong defeats the purpose of the eval.

The approach: read the skill content (summary + guide) for each product, then write cases that test whether Claude produces the correct SDK patterns with and without that content. The cases should test common developer scenarios, not edge cases.

## Feedback Strategy

**Inner-loop command**: `bun run eval -- --dry-run`

**Playground**: The eval harness itself — dry-run validates case loading and structure. Then a single-case run validates scoring against real API output.

**Why this approach**: Test cases are data, not logic. Dry-run catches structural issues (missing fields, bad YAML). Single-case runs catch inaccurate expected signals.

## File Changes

### New Files

| File Path                                | Purpose                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `scripts/eval/cases/sso.yaml`            | 3 SSO test cases (basic flow, org-level SSO, connection management)          |
| `scripts/eval/cases/authkit-nextjs.yaml` | 3 AuthKit/Next.js test cases (setup, protected routes, Next.js 15 specifics) |
| `scripts/eval/cases/directory-sync.yaml` | 2 Directory Sync test cases (list users, webhook handler)                    |
| `scripts/eval/cases/audit-logs.yaml`     | 2 Audit Logs test cases (create event, export logs)                          |
| `scripts/eval/cases/rbac.yaml`           | 2 RBAC test cases (check permission, role assignment)                        |

## Implementation Details

### Writing Accurate Test Cases

**Before writing each YAML file**, read the corresponding skill files to extract accurate signals:

1. Read the generated summary: `plugins/workos/skills/workos/references/workos-{product}.md`
2. Read the generated guide: `plugins/workos/skills/workos/references/workos-{product}.guide.md`
3. For AuthKit/Next.js, read: `plugins/workos/skills/workos-authkit-nextjs/SKILL.md`
4. Cross-reference with WorkOS docs if any method names or params seem uncertain

Expected signals must be **actually correct** — don't guess SDK method names.

### SSO Cases (`scripts/eval/cases/sso.yaml`)

**Skill**: `workos-sso` (generated)

3 cases covering the core SSO scenarios a Node.js developer encounters:

1. **`sso-node-basic`** — "Implement SSO login for Express app with authorization URL and callback"
   - Tests: `getAuthorizationUrl`, `getProfileAndToken`, redirect flow, env vars
   - This is the most basic SSO use case

2. **`sso-node-org-level`** — "Add organization-level SSO where different orgs have different IdP connections"
   - Tests: organization parameter, connection selection logic, multi-tenant SSO
   - Tests a decision the developer must make (org-level vs connection-level)

3. **`sso-node-connection-management`** — "List and manage SSO connections for an organization"
   - Tests: API methods for listing connections, admin portal generation
   - Tests the management side, not just the auth flow

**Expected signals per case**: methods (2-3), envVars (2-3), imports (1), params (3-5), flowSteps (4-5), antiPatterns (2-3), hallucinations (2-3 known wrong method names)

### AuthKit/Next.js Cases (`scripts/eval/cases/authkit-nextjs.yaml`)

**Skill**: `workos-authkit-nextjs` (hand-crafted)

3 cases that test framework-specific integration knowledge:

1. **`authkit-nextjs-setup`** — "Set up WorkOS AuthKit in a Next.js 15 app with login and protected routes"
   - Tests: SDK install, middleware setup, env vars (WORKOS_COOKIE_PASSWORD), AuthKitProvider
   - The core "get started" scenario

2. **`authkit-nextjs-protected`** — "Create a protected dashboard page and a public landing page using AuthKit"
   - Tests: `withAuth`/`getUser` usage, server component patterns, redirect logic
   - Tests understanding of Next.js-specific auth patterns

3. **`authkit-nextjs-15-specifics`** — "My AuthKit middleware works in Next.js 14 but breaks in 15. How do I fix it?"
   - Tests: async cookies() handling, version-specific middleware changes
   - Tests whether the skill prevents a known trap

### Directory Sync Cases (`scripts/eval/cases/directory-sync.yaml`)

**Skill**: `workos-directory-sync` (generated)

2 cases:

1. **`dsync-node-list-users`** — "List all users from a directory and handle pagination"
   - Tests: `listUsers`/`listDirectoryUsers` method, pagination cursor pattern, directory ID param

2. **`dsync-node-webhook`** — "Handle directory sync webhook events for user provisioning/deprovisioning"
   - Tests: webhook signature verification, event type handling (`dsync.user.created`, `dsync.user.deleted`), svix verification

### Audit Logs Cases (`scripts/eval/cases/audit-logs.yaml`)

**Skill**: `workos-audit-logs` (generated)

2 cases:

1. **`audit-logs-node-create`** — "Create an audit log event when a user updates their organization settings"
   - Tests: `createEvent` method, event schema (action, actor, target, metadata), organization context

2. **`audit-logs-node-export`** — "Export audit logs for compliance review"
   - Tests: `createExport` method, export format, date range filtering

### RBAC Cases (`scripts/eval/cases/rbac.yaml`)

**Skill**: `workos-rbac` (generated)

2 cases:

1. **`rbac-node-check-permission`** — "Check if the current user has permission to delete a resource before allowing the action"
   - Tests: authorization check pattern, permission slug format, role-based decision

2. **`rbac-node-assign-role`** — "Assign a 'billing-admin' role to a user in their organization"
   - Tests: role assignment method, organization-scoped roles, role slug naming

### Calibration Process

After running the first full eval:

1. **Review raw outputs** — Read the actual LLM outputs for 2-3 cases to sanity-check scoring
2. **Check for false positives** — Expected signals that score as "found" but are in wrong context
3. **Check for false negatives** — Correct code that doesn't match expected signals due to formatting
4. **Adjust weights if needed** — If method accuracy dominates too heavily, rebalance
5. **Document findings** — Write a brief calibration notes section to the JSON report

**Feedback loop**:

- **Playground**: Run `bun run eval -- --dry-run` after each YAML file to verify parsing
- **Experiment**: Run `bun run eval -- --case={first-case-id}` for each product to spot-check that expected signals are realistic
- **Check command**: `bun run eval -- --product=sso`

## Testing Requirements

### Manual Testing

- [ ] `bun run eval -- --dry-run` lists all 12 cases with correct product/skill/language metadata
- [ ] `bun run eval -- --case=sso-node-basic` completes and shows non-zero scores
- [ ] `bun run eval -- --product=sso` runs 3 cases and shows product summary
- [ ] `bun run eval` runs all 12 cases and produces full report table
- [ ] JSON report written to `scripts/output/eval-report-*.json` with complete structure
- [ ] Cache works: second run of same case hits cache (visible in timing or log)
- [ ] Review 2-3 "without skill" outputs — do they actually miss the expected signals?
- [ ] Review 2-3 "with skill" outputs — do they actually contain the expected signals?
- [ ] Delta is ≥20% for at least some products (validates that skills are adding value)

### Calibration Checks

- [ ] No expected signal scores 0% in the "with skill" arm (if it does, the signal is wrong or the skill doesn't cover it)
- [ ] No expected signal scores 100% in the "without skill" arm (if it does, the signal isn't testing skill value)
- [ ] Hallucination entries are specific enough to avoid false positives
- [ ] Anti-pattern entries are descriptive enough to match when present

## Error Handling

| Error Scenario                            | Handling Strategy                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| Expected signal never found in either arm | Flag in calibration — signal may be too specific or wrong                 |
| Expected signal always found in both arms | Flag in calibration — signal may be too generic (Claude already knows it) |
| Skill file not found for a case           | Log error, skip case, continue                                            |
| Composite score of 0                      | Log warning — likely API error or completely wrong expected signals       |

## Validation Commands

```bash
# Verify YAML structure
bun run eval -- --dry-run

# Run single product
bun run eval -- --product=sso

# Run single case
bun run eval -- --case=sso-node-basic

# Full run (all 12 cases, ~$0.25)
bun run eval

# Verify report exists
ls scripts/output/eval-report-*.json
```

## Open Items

- [ ] Exact SDK method names need verification against current WorkOS Node.js SDK docs during implementation — don't guess
- [ ] If calibration shows scoring weights are off, adjust in `scorer.ts` before expanding to more products
- [ ] If "without skill" scores are already high (>80%) for most cases, the skills may not be adding enough value — that's a valid finding, document it

---

_This spec is ready for implementation. Read skill files and WorkOS SDK docs before writing test case YAML — accuracy of expected signals is critical._
