<!-- refined:sha256:2336f8fb2339 -->

# WorkOS Migration: Clerk

## Step 1: Fetch Documentation (BLOCKING)

**STOP. Do not proceed until complete.**

WebFetch: `https://workos.com/docs/migrate/clerk`

The docs are the source of truth. If this skill conflicts with docs, follow docs.

## Step 2: Pre-Migration Assessment (Decision Tree)

```
Does your Clerk app use password auth?
  |
  +-- Yes --> Need Clerk Backend API access (Step 3)
  |           Cannot export plaintext passwords — will use Clerk's export format
  |
  +-- No (passwordless/SSO only) --> Skip to Step 4
                                     Simpler user data export
```

**Critical:** Clerk does NOT provide plaintext passwords. Migration will preserve password hashes in Clerk's format — WorkOS supports this.

## Step 3: Export User Data from Clerk

### Password-based users

Use Clerk Backend API to export users WITH password data as CSV:

**Verify export includes these columns:**

```bash
head -n1 export.csv | grep -E "email_addresses|first_name|last_name|password" || echo "FAIL: Missing required columns"
```

### Passwordless/SSO users

Standard user export via Clerk dashboard or API — passwords not required.

## Step 4: Import Strategy (Decision Tree)

```
How many users to migrate?
  |
  +-- <10,000 --> Use WorkOS migration tool (Step 5A, recommended)
  |               Handles rate limits, retries, logging
  |
  +-- 10,000+ --> Use WorkOS API directly (Step 5B)
                  Better control for large batches
                  Must implement rate limit handling
```

## Step 5A: Import via WorkOS Migration Tool (Recommended)

Clone: `https://github.com/workos/migrate-clerk-users`

Follow repository README for:

- CSV format requirements
- Rate limit handling (built-in)
- Error logging

**Verify import succeeded:**

```bash
# Check WorkOS user count matches Clerk export
curl -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/users" | jq '.data | length'
```

## Step 5B: Import via WorkOS API

### Field Mapping

| Clerk CSV column  | WorkOS API parameter |
| ----------------- | -------------------- |
| `email_addresses` | `email`              |
| `first_name`      | `first_name`         |
| `last_name`       | `last_name`          |

### Multi-Email Handling (CRITICAL TRAP)

Clerk exports multiple emails pipe-separated: `"john@example.com|john.doe@example.com"`

**Problem:** Export does NOT indicate primary email.

**Solution decision tree:**

```
Can you call Clerk API for each user?
  |
  +-- Yes --> Fetch User object, use primary_email_address_id
  |           Map to corresponding email from export
  |
  +-- No  --> Use FIRST email in pipe-separated list
              Document which email was chosen for each user
```

Code pattern:

```
emails = row['email_addresses'].split('|')
primary_email = emails[0]  # fallback if Clerk API unavailable

workos.users.create(
  email=primary_email,
  first_name=row['first_name'],
  last_name=row['last_name']
)
```

### Rate Limits

Check docs for Create User rate limits. Implement:

- Exponential backoff on 429 responses
- Batch processing (100-500 users per batch)
- Progress logging

## Step 6: Post-Migration Validation

Run ALL checks before declaring migration complete:

```bash
# 1. User count matches
CLERK_COUNT=$(wc -l < export.csv)
WORKOS_COUNT=$(curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/users?limit=1" | jq '.list_metadata.total')
[ "$CLERK_COUNT" -eq "$WORKOS_COUNT" ] && echo "✓ count match" || echo "✗ count mismatch"

# 2. Sample user exists with correct email
curl -s -H "Authorization: Bearer $WORKOS_API_KEY" \
  "https://api.workos.com/users?email=test@example.com" \
  | jq -e '.data[0].email == "test@example.com"' && echo "✓ user found" || echo "✗ user not found"

# 3. Password auth works (if migrated passwords)
# Test login with known Clerk credentials via WorkOS AuthKit
```

## Error Recovery

### "Rate limit exceeded" during import

- Check current rate limits in fetched docs
- Reduce batch size to 100 users per batch
- Add 1-second delay between batches
- Use migration tool (Step 5A) — handles this automatically

### "Invalid email format" for pipe-separated emails

- Check: Did you split on `|` character?
- Check: Did you choose ONE email per user (WorkOS users have single primary email)?
- Fix: `emails = row['email_addresses'].split('|')[0]`

### User count mismatch after import

**Most common causes:**

1. Clerk export includes deleted/suspended users — filter these before import
2. Duplicate emails in export — WorkOS rejects duplicate email addresses
3. Rate limit failures during import were not retried

**Fix:** Re-run import with deduplication and retry logic, or use migration tool which handles both.

### Password login fails after migration

- Check: Did you export passwords from Clerk Backend API (not standard export)?
- Check: Are you using WorkOS AuthKit for login (not custom auth)?
- Clerk password hashes require WorkOS to process them — confirm fetched docs support Clerk hash format
