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

- WorkOS API key starting with `sk_` (set as `WORKOS_API_KEY` environment variable)
- WorkOS SDK installed for your language/framework
- Organizations feature enabled in your WorkOS Dashboard environment

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations` | Create a new organization |
| GET | `/organizations/{id}` | Retrieve organization by WorkOS ID |
| GET | `/organizations/by_external_id/{external_id}` | Retrieve organization by your system's ID |
| GET | `/organizations` | List organizations with pagination |
| PUT | `/organizations/{id}` | Update organization attributes |
| DELETE | `/organizations/{id}` | Delete organization and SSO connections |

## Authentication Setup

Include your API key in the Authorization header:

```
Authorization: Bearer sk_your_api_key_here
```

SDK configuration pattern:
```
initialize_workos_client(api_key=WORKOS_API_KEY)
```

Check fetched docs for exact SDK initialization method for your language.

## Operation Decision Tree

### Creating Organizations

**When to use POST /organizations:**
- User signs up for a new account in your app
- Admin provisions a new tenant/workspace
- SSO connection requires an organization container

**Pattern:**
```
organization = create_organization(
  name="Acme Corp",
  domains=["acme.com"],
  external_id="your_system_id_123"  // OPTIONAL: your database ID
)
// Returns organization object with org_xxx ID
```

**Key decision:** Set `external_id` if you need to map WorkOS organizations to your existing database records. This enables bidirectional lookups.

### Reading Organizations

**Decision tree:**
- Have WorkOS `org_xxx` ID? → Use GET /organizations/{id}
- Have YOUR system's ID? → Use GET /organizations/by_external_id/{external_id}
- Need to list/search? → Use GET /organizations with query parameters

**Pattern for ID lookup:**
```
organization = get_organization(id="org_xxx")
```

**Pattern for external ID lookup:**
```
organization = get_organization_by_external_id(external_id="your_system_id_123")
```

**Pattern for listing:**
```
organizations = list_organizations(
  limit=20,
  after="cursor_value",  // for pagination
  before=null,
  domains=["acme.com"],  // OPTIONAL: filter by domain
  external_id="prefix_"   // OPTIONAL: filter by external_id pattern
)
```

### Updating Organizations

**When to use PUT /organizations/{id}:**
- User renames their workspace
- Admin changes allowed domains
- Organization metadata needs updating

**Pattern:**
```
updated_org = update_organization(
  id="org_xxx",
  name="New Name",
  domains=["newdomain.com", "olddomain.com"]
)
```

**Trap:** The update endpoint is NOT a partial patch — include all fields you want to retain. Check fetched docs for which fields are mutable.

### Deleting Organizations

**When to use DELETE /organizations/{id}:**
- User closes their account
- Admin removes a tenant
- Cleanup after tests

**Pattern:**
```
delete_organization(id="org_xxx")
// Returns 204 on success
```

**Trap:** Deletion cascades to SSO connections. Ensure users are logged out and connections are terminated before deletion. This operation is NOT reversible.

## Pagination Handling

The list endpoint uses cursor-based pagination:

```
first_page = list_organizations(limit=20)

// Check if more results exist
if first_page.list_metadata.after:
  next_page = list_organizations(
    limit=20,
    after=first_page.list_metadata.after
  )
```

**Pattern for fetching all:**
```
all_orgs = []
cursor = null

while true:
  page = list_organizations(limit=100, after=cursor)
  all_orgs.extend(page.data)
  
  if not page.list_metadata.after:
    break
  cursor = page.list_metadata.after
```

Check fetched docs for exact pagination metadata structure.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key or missing Authorization header | Verify `WORKOS_API_KEY` starts with `sk_` and is set correctly |
| 404 | Organization ID not found | Verify the `org_xxx` ID exists — may have been deleted |
| 409 | Duplicate external_id | Your `external_id` is already used by another organization — choose a unique value |
| 422 | Invalid request parameters | Check required fields and data types in fetched docs |
| 429 | Rate limit exceeded | Implement exponential backoff with 1s, 2s, 4s delays |

**Trap:** A 404 on `/organizations/by_external_id/{external_id}` means no organization has that external_id — it does NOT mean the endpoint is wrong.

## Runnable Verification

**Test API key:**
```bash
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with organization list (may be empty).

**Test organization creation:**
```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "domains": ["test.example.com"]
  }'
```

Expected: 201 response with new organization object containing `org_xxx` ID.

**Test external_id lookup:**
```bash
curl -X GET "https://api.workos.com/organizations/by_external_id/your_test_id" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 if organization exists with that external_id, 404 otherwise.

## Rate Limits

Check fetched docs for current rate limit values. General guidance:

- Implement retry logic with exponential backoff for 429 responses
- Cache organization lookups when possible (organizations change infrequently)
- Batch operations when creating multiple organizations (if supported)

## Common Integration Patterns

### Pattern: Sync Your Database to WorkOS

When a user creates an account in your system:
```
your_user = create_user_in_your_db(name="Alice")

workos_org = create_organization(
  name=your_user.company_name,
  external_id=your_user.id  // enables bidirectional lookup
)

// Store org_xxx in your database
update_user_in_your_db(your_user.id, workos_org_id=workos_org.id)
```

### Pattern: Fetch Organization for SSO Login

When a user attempts SSO login:
```
// You have their email domain from login form
organizations = list_organizations(domains=["user-domain.com"])

if organizations.data:
  org = organizations.data[0]
  // Proceed with SSO flow using org.id
else:
  // No organization configured for this domain
  // Show "contact admin" message
```

### Pattern: Graceful Deletion

Before deleting an organization:
```
// 1. Notify users and give grace period
send_deletion_warnings(org_id)

// 2. Terminate active sessions
revoke_sessions_for_organization(org_id)

// 3. Archive data in your system
archive_organization_data(org_id)

// 4. Delete from WorkOS (cascades to SSO connections)
delete_organization(id=org_id)

// 5. Clean up references in your database
remove_org_references(org_id)
```

## Related Skills

- workos-authkit-base — authentication implementation using Organizations for multi-tenant context
