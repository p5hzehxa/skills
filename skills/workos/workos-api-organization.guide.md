<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference — Implementation Guide

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id
- https://workos.com/docs/reference/organization/list
- https://workos.com/docs/reference/organization/update

## Prerequisites

- WorkOS API key (`WORKOS_API_KEY`) starting with `sk_`
- WorkOS client ID (`WORKOS_CLIENT_ID`) starting with `client_`
- WorkOS SDK installed in your project

## Authentication Setup

Add your WorkOS API key to requests:

```bash
# All API calls require this header
Authorization: Bearer ${WORKOS_API_KEY}
```

SDK initialization pattern:

```
import WorkOS SDK
initialize SDK with WORKOS_API_KEY
```

Check fetched docs for exact SDK initialization method for your language.

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/organizations` | List all organizations (paginated) |
| POST | `/organizations` | Create a new organization |
| GET | `/organizations/{id}` | Get organization by WorkOS ID |
| GET | `/organizations/by_external_id/{external_id}` | Get organization by your system's ID |
| PUT | `/organizations/{id}` | Update an existing organization |
| DELETE | `/organizations/{id}` | Delete an organization |

## Operation Decision Tree

**Creating vs. Updating Organizations**

```
Do you have the WorkOS organization ID (org_*)?
├─ YES → Use PUT /organizations/{id} to update
└─ NO → Do you have your system's external_id?
    ├─ YES → GET /organizations/by_external_id/{external_id} first
    │        └─ If found → Use PUT /organizations/{id}
    │        └─ If 404 → Use POST /organizations
    └─ NO → Use POST /organizations (save the returned org ID)
```

**Looking Up Organizations**

```
What identifier do you have?
├─ WorkOS ID (org_*) → GET /organizations/{id}
├─ Your system's ID → GET /organizations/by_external_id/{external_id}
└─ Need to browse all → GET /organizations (handle pagination)
```

**Deleting Organizations**

```
DELETE /organizations/{id}
└─ Requires WorkOS organization ID (org_*)
└─ If you only have external_id, fetch the org first to get its ID
```

## Pagination Handling

The list endpoint (`GET /organizations`) supports pagination:

```bash
# First page
GET /organizations?limit=10

# Response includes pagination metadata
{
  "data": [...],
  "list_metadata": {
    "before": "cursor_value",
    "after": "cursor_value"
  }
}

# Next page
GET /organizations?limit=10&after={cursor_value}
```

Pattern for consuming all pages:

```
cursor = null
loop:
  response = fetch /organizations with cursor
  process response.data
  if response.list_metadata.after exists:
    cursor = response.list_metadata.after
  else:
    break
```

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | API key missing or malformed | Verify `WORKOS_API_KEY` starts with `sk_` and is in Authorization header |
| 403 | API key lacks permissions | Check key permissions in WorkOS Dashboard |
| 404 | Organization not found | Verify organization ID or external_id exists in your WorkOS environment |
| 409 | Duplicate external_id | Your external_id must be unique across organizations — use a different value or fetch the existing org |
| 422 | Invalid request payload | Check fetched docs for required fields and valid values for the specific endpoint |
| 429 | Rate limit exceeded | Implement exponential backoff (wait 1s, 2s, 4s, etc.) before retrying |
| 500/502/503 | WorkOS service error | Retry with exponential backoff — these are transient |

## Common Integration Patterns

### Pattern: Sync Organization from Your System

```
function syncOrganization(yourOrgData):
  try:
    # Try to find existing org by your ID
    org = GET /organizations/by_external_id/{yourOrgData.id}
    
    # Update existing
    result = PUT /organizations/{org.id} with {
      name: yourOrgData.name,
      domains: yourOrgData.domains
    }
  catch 404:
    # Create new
    result = POST /organizations with {
      name: yourOrgData.name,
      domains: yourOrgData.domains,
      external_id: yourOrgData.id
    }
  
  return result.id  # Save this for future updates
```

### Pattern: Handle External ID Collisions

If you get a 409 when creating an organization:

```
catch 409:
  # Another org already has this external_id
  # Either:
  # 1. Fetch the existing org and update it instead
  existingOrg = GET /organizations/by_external_id/{external_id}
  update that org
  
  # OR 2. Use a different external_id (e.g., append a suffix)
  retry with modified external_id
```

### Pattern: Bulk Organization Migration

```
for each orgInYourSystem:
  # Add delay to respect rate limits
  sleep(100ms)
  
  try:
    POST /organizations with {
      name: orgInYourSystem.name,
      external_id: orgInYourSystem.id,
      domains: orgInYourSystem.domains
    }
  catch 409:
    # Already exists — skip or update
    continue
  catch 429:
    # Hit rate limit — back off
    sleep(5s)
    retry
```

## Verification Commands

**Test API key authentication:**

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Success: Returns {"data": [...], "list_metadata": {...}}
# Failure: Returns {"error": "unauthorized", ...}
```

**Test creating an organization:**

```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "external_id": "test-org-123",
    "domains": ["test.example.com"]
  }'

# Success: Returns organization object with "id": "org_*"
# Save this ID for update/delete tests
```

**Test fetching by external ID:**

```bash
curl https://api.workos.com/organizations/by_external_id/test-org-123 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Success: Returns organization object
# 404: Organization with that external_id doesn't exist
```

**Test updating an organization:**

```bash
curl -X PUT https://api.workos.com/organizations/org_12345 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Organization Name"
  }'

# Success: Returns updated organization object
```

**Test deleting an organization:**

```bash
curl -X DELETE https://api.workos.com/organizations/org_12345 \
  -H "Authorization: Bearer ${WORKOS_API_KEY}"

# Success: Returns 204 No Content
# 404: Organization doesn't exist
```

## Rate Limits

Check fetched docs for current rate limits. Implement exponential backoff for 429 responses:

```
attempt = 1
max_attempts = 5

loop:
  response = make_request()
  
  if response.status == 429:
    if attempt >= max_attempts:
      fail with rate limit error
    
    wait_seconds = 2^attempt  # 2, 4, 8, 16 seconds
    sleep(wait_seconds)
    attempt += 1
    continue
  
  return response
```

## Trap Warnings

**External ID is NOT required but strongly recommended** — without it, you cannot reliably look up organizations from your system. Always set `external_id` to your internal organization identifier.

**Domains are verified asynchronously** — when you add a domain to an organization, WorkOS validates it in the background. A successful POST/PUT doesn't mean the domain is verified yet. Check the `domains` array in the organization object for verification status.

**Deleting an organization is permanent** — this removes all associated directory syncs, SSO connections, and user data. There is no undo. Confirm deletion in your UI before calling DELETE.

**Organization IDs vs. External IDs** — WorkOS assigns org IDs (`org_*`) that are stable. Your external IDs can change if you update them. When storing references, prefer WorkOS IDs for stability.

**Empty updates are no-ops** — calling PUT with no changes returns success but doesn't trigger webhooks or audit events. Always include at least one field you're actually changing.

## Related Skills

- workos-user-management (for managing users within organizations)
- workos-directory-sync-setup (for syncing directory data into organizations)
- workos-sso-connection-setup (for enabling SSO for organizations)
