---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## Step 1: Fetch Documentation

**STOP. WebFetch the relevant docs for latest implementation details before proceeding.**

- https://workos.com/docs/reference/organization
- https://workos.com/docs/reference/organization/create
- https://workos.com/docs/reference/organization/delete
- https://workos.com/docs/reference/organization/get
- https://workos.com/docs/reference/organization/get-by-external-id
- https://workos.com/docs/reference/organization/list
- https://workos.com/docs/reference/organization/update

## Available Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations` | Create a new organization |
| GET | `/organizations/{id}` | Retrieve organization by WorkOS ID |
| GET | `/organizations?external_id={id}` | Retrieve organization by your system's ID |
| GET | `/organizations` | List organizations with pagination |
| PUT | `/organizations/{id}` | Update organization attributes |
| DELETE | `/organizations/{id}` | Remove an organization |

## Authentication Setup

Set your API key as a bearer token in all requests:

```bash
Authorization: Bearer sk_test_your_key_here
```

Verify your key:

```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json"
```

Expected: 200 response with organization list (may be empty).

## Operation Decision Tree

### Creating vs Updating Organizations

**Use POST /organizations when:**
- First-time organization setup during user onboarding
- Importing organizations from another system
- User creates a new workspace/team in your app

**Use PUT /organizations/{id} when:**
- Modifying existing organization name or attributes
- Enabling/disabling SSO domains for an organization
- Updating organization metadata after creation

**Use external_id to bridge systems:**
- Store your internal org ID as `external_id` during creation
- Use GET with `external_id` query parameter to retrieve by your ID
- This allows you to work with your IDs instead of WorkOS IDs

### Retrieving Organizations

**Use GET /organizations/{id} when:**
- You have the WorkOS organization ID (starts with `org_`)
- Fetching organization details after webhook events
- Looking up organization from WorkOS authentication responses

**Use GET /organizations?external_id={id} when:**
- You have your system's organization identifier
- Your database stores external IDs but not WorkOS IDs
- Migrating from another provider and need to map existing IDs

**Use GET /organizations (list) when:**
- Building admin dashboards showing all organizations
- Syncing organization data to your analytics system
- Auditing organization configurations across your application

Decision: If you control the ID, always set `external_id` during creation. This eliminates ID mapping complexity.

## Pagination Pattern

The list endpoint returns paginated results. To fetch all organizations:

```
GET /organizations?limit=100&order=desc
```

Response includes:
- `data[]`: Array of organization objects
- `list_metadata.after`: Cursor for next page
- `list_metadata.before`: Cursor for previous page

To fetch next page:
```
GET /organizations?limit=100&after={cursor_value}
```

Continue until `list_metadata.after` is null.

Trap: The API uses cursor-based pagination, not offset. Do NOT construct page numbers — use the `after` cursor from the response.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | API key missing or malformed | Verify `Authorization: Bearer sk_...` header format |
| 403 | API key lacks organization permissions | Check key scopes in WorkOS Dashboard → API Keys |
| 404 | Organization ID not found | Verify `org_` prefix; check organization exists via list endpoint |
| 409 | Duplicate `external_id` | Each external_id must be unique; query by external_id first to check |
| 422 | Invalid domain format in `domains` array | Domain must be valid hostname without protocol (example.com, not https://example.com) |
| 429 | Rate limit exceeded | Implement exponential backoff starting at 1s; WorkOS limits to 600 req/min |

Trap: 404 on GET by external_id means no match — it does NOT mean the ID is invalid. Create the organization if this is expected.

## Rate Limit Guidance

WorkOS enforces 600 requests per minute per API key. For bulk operations:

```python
# Pattern: Batch with delay
for batch in chunks(organizations, 100):
    for org in batch:
        create_organization(org)
    time.sleep(10)  # 100 requests per 10s = 600/min
```

If you receive 429, retry with exponential backoff: 1s, 2s, 4s, 8s.

## Verification Commands

**Test authentication:**
```bash
curl https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Create test organization:**
```bash
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer $WORKOS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Org", "external_id": "test-001"}'
```

**Retrieve by external_id:**
```bash
curl "https://api.workos.com/organizations?external_id=test-001" \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

**Clean up test organization:**
```bash
curl -X DELETE https://api.workos.com/organizations/org_test_id \
  -H "Authorization: Bearer $WORKOS_API_KEY"
```

## Common Integration Patterns

### Pattern: Just-in-Time Organization Creation

When a user signs up and creates a workspace:

```
1. POST /organizations with name + external_id (your workspace ID)
2. Store returned org.id in your database
3. Configure SSO/Directory if needed using org.id
4. Redirect user to onboarding flow
```

### Pattern: Organization Lookup in Authentication Flow

When user authenticates via WorkOS:

```
1. Extract organization_id from authentication response
2. GET /organizations/{organization_id} to fetch details
3. Map to your internal workspace/tenant
4. Load user's role and permissions for that organization
```

### Pattern: Bulk Import from Another Provider

When migrating from Auth0/Okta/etc:

```
1. Export organization list from old provider
2. For each organization:
   - POST /organizations with external_id = old_provider_id
   - Store WorkOS org.id in migration mapping table
3. Update your application's organization references
4. Configure SSO connections using new org.ids
```

Trap: Do NOT attempt to preserve old organization IDs as WorkOS IDs — use external_id for mapping.

## SDK Usage Patterns

Refer to fetched documentation for language-specific SDK methods and exact parameter signatures.

**General pattern for creation:**
```
sdk.organizations.create({
  name: "Organization Name",
  external_id: "your_internal_id",
  domains: ["company.com"]  // Optional: for domain-based routing
})
```

**General pattern for updates:**
```
sdk.organizations.update(organization_id, {
  name: "Updated Name",
  domains: ["newdomain.com"]
})
```

Check fetched docs for idempotency behavior and which fields are mutable.

## Related Skills

- workos-authkit-nextjs — Organizations integrate with AuthKit authentication flows
- workos-authkit-react — Client-side organization context after authentication
