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

- WorkOS API key (`WORKOS_API_KEY`) — starts with `sk_` prefix
- WorkOS SDK installed (`npm install @workos-inc/node` for Node.js)
- Organization IDs follow format: `org_XXXXXXXXXXXXXXXXXXXX`

## Endpoint Catalog

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/organizations` | Create a new organization |
| GET | `/organizations/:id` | Retrieve organization by ID |
| GET | `/organizations/by_external_id/:external_id` | Retrieve organization by your system's ID |
| GET | `/organizations` | List all organizations (paginated) |
| PUT | `/organizations/:id` | Update organization properties |
| DELETE | `/organizations/:id` | Remove organization |

## Authentication Setup

Set the API key in your environment:

```bash
export WORKOS_API_KEY=sk_live_...
```

SDK initialization pattern:

```
import { WorkOS } from '@workos-inc/node'
const workos = new WorkOS(process.env.WORKOS_API_KEY)
```

All requests require the API key in the `Authorization` header as a Bearer token.

## Operation Decision Tree

### Creating Organizations

**Use POST `/organizations`** when:
- Onboarding a new customer/tenant
- Syncing an external organization to WorkOS for the first time
- You need WorkOS to generate the organization ID

**Required fields:** Check fetched docs for current requirements

**Set `external_id`** to your system's identifier — enables lookup without storing WorkOS IDs everywhere.

### Updating Organizations

**Use PUT `/organizations/:id`** when:
- Modifying organization name, logo, or custom domains
- Updating metadata after organization creation
- You have the WorkOS organization ID (`org_...`)

**TRAP:** PUT replaces entire fields. Check fetched docs for partial update behavior.

### Retrieving Organizations

**Decision matrix:**

| You Have | Use Endpoint | When |
|----------|-------------|------|
| WorkOS org ID (`org_...`) | GET `/organizations/:id` | After user login, webhook events |
| Your system's ID | GET `/organizations/by_external_id/:external_id` | When mapping from your DB |
| Need to browse all | GET `/organizations` | Admin dashboards, reporting |

**Fetch by external ID** avoids storing WorkOS IDs in your database — use your existing tenant/customer ID as the bridge.

### Deleting Organizations

**Use DELETE `/organizations/:id`** when:
- Customer churns and requests data deletion
- Cleaning up test organizations

**TRAP:** Deletion is permanent. Check fetched docs for cascade behavior (connections, directory sync, etc.)

## Pagination Pattern

The list endpoint returns paginated results:

```
GET /organizations?limit=10&after=org_XXXXX
```

**Pattern:**
1. Make initial request with `limit` parameter
2. Response includes `list_metadata` with `after` cursor
3. Pass `after` cursor to next request
4. Continue until `list_metadata.after` is null

Check fetched docs for current pagination parameters and response structure.

## Error Code Mapping

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Invalid API key format or missing header | Verify key starts with `sk_` and Authorization header is set |
| 403 | Valid key but insufficient permissions | Check Dashboard → API Keys for key scope |
| 404 | Organization ID not found | Verify ID format (`org_...`) and that org exists |
| 409 | `external_id` already exists | Use GET by external ID or choose different external ID |
| 422 | Invalid request parameters | Check fetched docs for required/allowed fields |
| 429 | Rate limit exceeded | Implement exponential backoff (start with 1s delay) |
| 500 | WorkOS server error | Retry with exponential backoff (transient) |

## Rate Limit Guidance

WorkOS applies rate limits per API key. When you hit 429:

```
Retry-After: 5
```

**Strategy:**
1. Parse `Retry-After` header (seconds)
2. Wait specified duration before retry
3. If header missing, use exponential backoff: 1s → 2s → 4s → 8s
4. Maximum 5 retries before failing

## Verification Commands

Test API connectivity:

```bash
# Test authentication and list organizations
curl -X GET https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json"
```

Verify organization creation:

```bash
# Create test organization
curl -X POST https://api.workos.com/organizations \
  -H "Authorization: Bearer ${WORKOS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Org",
    "external_id": "test-org-001"
  }'
```

Expected response status: `201 Created` with organization object in body.

## Common Integration Patterns

### Pattern 1: Sync on User Signup

```
1. User signs up in your app
2. POST /organizations with external_id = your_customer_id
3. Store returned org.id for future webhook matching
4. Proceed with SSO/Directory Sync setup using org.id
```

### Pattern 2: Lazy Organization Creation

```
1. User initiates SSO login
2. Lookup organization by external_id
3. If not found, POST /organizations inline
4. Continue SSO flow with org.id
```

### Pattern 3: Bulk Import

```
1. Fetch existing customers from your database
2. For each customer:
   - POST /organizations with external_id
   - Handle 409 conflicts (already exists)
3. Store WorkOS org.id mapping
```

## Related Skills

- **workos-authkit-nextjs** — Integrate organizations with AuthKit authentication
- **workos-sso** — Enable SSO connections for organizations
- **workos-directory-sync** — Sync user directories to organizations
