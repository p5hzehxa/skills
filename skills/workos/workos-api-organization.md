---
name: workos-api-organization
description: WorkOS Organizations API endpoints — create, update, list, and manage organizations.
---

<!-- refined:sha256:b8333364728d -->

# WorkOS Organizations API Reference

## When to Use

Use this API to manage multi-tenant structures in WorkOS. Organizations represent distinct tenants (companies, teams, workspaces) in your application. You'll need this when building B2B features like SSO connections, Directory Sync integrations, or Role-Based Access Control — all of which are scoped to an organization. Use organizations to isolate customer data, manage billing boundaries, and configure per-tenant authentication settings.

## Key Concepts

**Core Model**
- **Organization** — represents a tenant/customer company in your app; identified by `org_` prefix
- **External ID** — optional customer-side identifier you control (e.g., your internal account UUID); enables lookups via `getOrganizationByExternalId()`
- **Domains** — email domains associated with an organization (e.g., `acme.com`); used for JIT provisioning and domain verification

**ID Patterns**
- Organization ID format: `org_01H7ZGXFP5C6BBQY6Z7277ZCT0`
- External ID: your own string identifier (no format constraint)

**Management Operations**
- **Create** — provision new tenant with name, optional domains, and external_id
- **Update** — modify name or domains; use for tenant settings changes
- **Delete** — remove organization and cascade-delete dependent resources (connections, directories)
- **Get** — retrieve by WorkOS `org_id`
- **Get by External ID** — retrieve by your own identifier
- **List** — paginate through organizations with optional domain/external_id filters

**Integration Touchpoints**
- Organizations are the parent resource for SSO connections (`connection_id` → `org_id`)
- Directory Sync directories are scoped to organizations
- User Management roles use organization slugs as scope identifiers
- AuthKit redirects and session tokens include organization context

**Architectural Decisions**
- Use external_id if you have existing tenant identifiers — avoids dual-key lookups
- Delete operations are destructive and cascade — verify no active users/connections before deletion
- List endpoint supports pagination (default 10, max 100) — use `before`/`after` cursors for large datasets
- Domain associations enable automatic organization detection during SSO flows

**Common Patterns**
- **Provisioning flow**: create organization → add domains → configure SSO connection
- **Migration**: use external_id to map existing tenant IDs during onboarding
- **Lookup strategy**: use `getOrganizationByExternalId()` if you store your own IDs; use `getOrganization()` if you store WorkOS org_id

**Traps**
- External IDs must be unique across your environment — duplicate external_id will fail
- Deleting an organization destroys all child resources (connections, directories) — no soft delete
- Domain strings are case-insensitive and normalized by WorkOS

## Implementation Guide

For step-by-step implementation, verification commands, and error recovery:

→ Read `skills/workos/workos-api-organization.guide.md`
