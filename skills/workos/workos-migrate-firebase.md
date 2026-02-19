---
name: workos-migrate-firebase
description: Migrate to WorkOS from Firebase.
---

<!-- refined:sha256:bdf357fa5da5 -->

# WorkOS Migration: Firebase

## When to Use

Use this skill when migrating an existing user base from Firebase Authentication to WorkOS. Firebase stores password hashes in scrypt format, which WorkOS supports natively — making this one of the smoothest migration paths available. This skill covers both the technical migration (exporting hashes, importing to WorkOS) and the rollout strategy (dual-write patterns, gradual cutover).

## Documentation

- https://workos.com/docs/migrate/firebase

## Key Concepts

**Migration Strategy Patterns**
- **Dual-write period** — run both Firebase and WorkOS simultaneously during migration, writing to both systems
- **Gradual rollout** — migrate users in cohorts (e.g., 10% → 50% → 100%) rather than all-at-once
- **Lazy migration** — migrate users on next login instead of bulk import (reduces upfront work)

**Firebase-Specific Constraints**
- Firebase exports password hashes in **scrypt** format via the Firebase Admin SDK
- Export includes: `uid`, `email`, `passwordHash`, `salt`, `scryptConfig` (signer key, salt separator, rounds, memory cost)
- Firebase does NOT provide plaintext passwords — only the derived scrypt hash
- Social login users (Google, GitHub, etc.) have NO password hash — handle separately

**WorkOS Password Import Requirements**
- Use the **User Management API** `POST /user_management/users` endpoint with `password_hash` parameter
- WorkOS accepts scrypt hashes when `password_hash_type: "scrypt"` is specified
- Must provide: `hash`, `salt`, and scrypt config parameters (`signer_key`, `salt_separator`, `rounds`, `memory_cost`)
- WorkOS validates the hash format on import — malformed hashes will be rejected

**ID Mapping Strategy**
- Firebase uses `uid` (e.g., `abc123xyz`) — WorkOS generates `user_` prefixed IDs
- Store bidirectional mapping: `firebase_uid` ↔ `workos_user_id` in your database
- Use custom user metadata in WorkOS to store `firebase_uid` for reverse lookups

**User Data Export Process**
- Use Firebase Admin SDK `auth().listUsers()` to iterate through all users
- Export returns paginated results — handle `pageToken` for large user bases
- Save export to JSON or CSV for batch import to WorkOS
- Check fetched docs for Firebase Admin SDK version and exact method signature

**Social Login Accounts (No Password Hash)**
- Firebase users authenticated via Google/GitHub/etc. have NO password hash to migrate
- Options: (1) force password reset flow, (2) keep social login enabled, (3) migrate to WorkOS SSO connections
- Recommended: enable WorkOS AuthKit social providers and map Firebase provider accounts

**Email Verification State**
- Firebase tracks `emailVerified` boolean — WorkOS tracks similar state
- Decision: import as verified (faster) or force re-verification (more secure)
- Set `email_verified: true` in WorkOS import payload to preserve verification state

**Rollout Decision Tree**
1. **Small user base (<10k)**: bulk import all users, switch DNS/routing in one cutover
2. **Medium user base (10k-100k)**: dual-write for 1-2 weeks, migrate in cohorts, gradually shift traffic
3. **Large user base (>100k)**: lazy migration (migrate on login), dual-write for 1-3 months, monitor error rates

**Common Traps**
- Forgetting to migrate `emailVerified` state → users forced to re-verify unnecessarily
- Not testing scrypt config parameters → import fails silently or password validation fails
- Skipping dual-write period → cannot roll back if migration issues arise
- Not handling social login users separately → authentication breaks for subset of users

**Verification Commands**
```bash
# Verify Firebase Admin SDK installed
npm list firebase-admin

# Test Firebase export (first 10 users)
node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().listUsers(10).then(r => console.log(JSON.stringify(r, null, 2)))"

# Verify WorkOS SDK installed
npm list @workos-inc/node

# Test WorkOS connection
curl https://api.workos.com/user_management/users \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-migrate-firebase.guide.md`

## Related Skills

- `workos-user-management` — creating and managing users in WorkOS after migration
- `workos-authkit-base` — setting up authentication UI post-migration
- `workos-organizations` — if migrating Firebase tenants/organizations alongside users
