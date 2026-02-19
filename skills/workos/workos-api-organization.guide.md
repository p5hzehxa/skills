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
- WorkOS SDK installed for your language
- Organization Management enabled in WorkOS Dashboard

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations` | Create a new organization |
| GET | `/organizations/:id` | Get organization by ID |
| GET | `/organizations/by_external_id/:external_id` | Get organization by external ID |
| GET | `/organizations` | List organizations (paginated) |
| PUT | `/organizations/:id` | Update organization |
| DELETE | `/organizations/:id` | Delete organization |

## Authentication Pattern

All requests require Bearer token authentication:

```bash
Authorization: Bearer sk_your_api_key
```

Set your API key:

```bash
export WORKOS_API_KEY="sk_your_api_key"
```

## Operation Decision Tree

### Creating Organizations

**Use POST /organizations when:**
- First-time organization setup
- You don't have an existing organization ID
- You need WorkOS to generate the organization ID

**Pattern:**
```pseudocode
response = workos.organizations.create(
  name="Company Name",
  domains=["company.com"],
  external_id="your_system_id"  // optional but recommended
)
organization_id = response.id  // Starts with org_
```

### Reading Organizations

**Use GET /organizations/:id when:**
- You have the WorkOS organization ID (`org_*`)
- Fetching by primary key

**Use GET /organizations/by_external_id/:external_id when:**
- You're referencing by your own system's ID
- Bridging between your DB and WorkOS

**Use GET /organizations (list) when:**
- Building admin interfaces
- Syncing all organizations
- Searching/filtering organizations

**Pattern for lookup by external ID:**
```pseudocode
organization = workos.organizations.get_by_external_id(
  external_id="your_system_id"
)
```

### Updating Organizations

**Use PUT /organizations/:id when:**
- Modifying organization name
- Adding/removing domains
- Updating external_id or other metadata

**Pattern:**
```pseudocode
updated_org = workos.organizations.update(
  organization_id="org_123",
  name="New Company Name",
  domains=["newdomain.com", "olddomain.com"]
)
```

**Trap:** Updates replace entire arrays. To add a domain, include ALL domains in the update request.

### Deleting Organizations

**Use DELETE /organizations/:id when:**
- Removing test organizations
- Handling account closure

**Pattern:**
```pseudocode
workos.organizations.delete(organization_id="org_123")
```

**Trap:** Deletion is permanent and cascades to connections. Confirm before deleting production organizations.

## Pagination Pattern

The list endpoint returns paginated results:

```pseudocode
response = workos.organizations.list(
  limit=10,
  after="org_123"  // cursor from previous response
)

organizations = response.data
next_cursor = response.list_metadata.after  // Use for next page
```

**Pattern:**
- Default page size: 10
- Maximum page size: check fetched docs
- Use `after` cursor for next page
- `before` cursor for previous page

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key | Verify `WORKOS_API_KEY` starts with `sk_` and is active in Dashboard |
| 404 | Organization not found | Verify organization ID starts with `org_`. Check it exists via list endpoint |
| 409 | Domain conflict | Another organization already uses this domain. Remove from other org first |
| 422 | Invalid domain format | Domain must be valid FQDN (e.g., "company.com" not "https://company.com") |
| 429 | Rate limit exceeded | Implement exponential backoff. Start with 1s delay, double on each retry |

## Verification Commands

### Test API connectivity:
```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with `{"data": [...], "list_metadata": {...}}`

### Create test organization:
```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org", "domains": ["test.example.com"]}'
```

Expected: 201 response with `org_*` ID

### Verify by external ID:
```bash
curl https://api.workos.com/organizations/by_external_id/YOUR_ID \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

Expected: 200 response with organization object or 404 if not found

## Rate Limiting

- Rate limits vary by plan tier
- Check `X-RateLimit-Remaining` response header
- Implement retry with exponential backoff starting at 1 second

**Backoff pattern:**
```pseudocode
max_retries = 3
delay = 1  // seconds

for attempt in 1..max_retries:
  response = make_request()
  if response.status == 429:
    sleep(delay)
    delay = delay * 2
  else:
    break
```

## Common Integration Patterns

### Provisioning Flow
1. User signs up in your application
2. Create organization via POST /organizations with `external_id` set to your user/tenant ID
3. Store returned `org_*` ID in your database
4. Create connections for the organization

### Lookup Flow
1. User logs in to your application
2. Retrieve your internal user/tenant ID
3. Fetch organization via GET /organizations/by_external_id/:external_id
4. Use returned organization data for connection/directory operations

### Sync Flow
1. Fetch all organizations via GET /organizations with pagination
2. Compare against your local database
3. Update local records as needed
4. Store cursor for incremental sync

## Related Skills

- workos-authkit-nextjs — Authentication implementation with organizations
- workos-authkit-react — React-based authentication with organization context
