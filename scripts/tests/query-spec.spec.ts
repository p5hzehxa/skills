import { describe, expect, it } from 'vitest';
import {
  resolveRef,
  resolveSchema,
  extractEndpoints,
  formatEndpoint,
  groupPathsByWidget,
  loadSpec,
  WIDGET_PREFIXES,
  type EndpointInfo,
} from '../../plugins/workos/skills/workos-widgets/references/scripts/query-spec.ts';

// --- Minimal spec fixtures ---

function makeSpec(overrides: Record<string, unknown> = {}) {
  return {
    paths: {
      '/_widgets/UserProfile/me': {
        get: {
          description: 'Returns the current user profile',
          parameters: [],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Me' },
                },
              },
            },
            '403': {
              description: 'Forbidden',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { message: { type: 'string' } },
                    required: ['message'],
                  },
                },
              },
            },
          },
        },
        post: {
          description: 'Updates the current user profile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Me' },
                },
              },
            },
          },
        },
      },
      '/_widgets/UserManagement/members': {
        get: {
          description: 'List members',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'after', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/MembersList' },
                },
              },
            },
          },
        },
      },
      '/_widgets/admin-portal/sso-connections': {
        get: {
          description: 'List SSO connections',
          responses: {
            '200': { description: 'OK' },
          },
        },
      },
      '/_widgets/settings': {
        get: {
          description: 'Get widget settings',
          responses: {
            '200': { description: 'OK' },
          },
        },
      },
    },
    components: {
      schemas: {
        Me: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['id', 'email'],
        },
        MembersList: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Member' },
            },
          },
        },
        Member: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            role: { type: 'string' },
          },
        },
      },
    },
    ...overrides,
  } as Record<string, unknown>;
}

// --- resolveRef ---

describe('resolveRef', () => {
  const spec = makeSpec();

  it('resolves a top-level schema $ref', () => {
    const result = resolveRef(spec, '#/components/schemas/Me') as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.type).toBe('object');
    expect(result.required).toEqual(['id', 'email']);
  });

  it('returns undefined for non-existent ref', () => {
    expect(resolveRef(spec, '#/components/schemas/DoesNotExist')).toBeUndefined();
  });

  it('returns undefined for deeply broken path', () => {
    expect(resolveRef(spec, '#/a/b/c/d/e')).toBeUndefined();
  });

  it('resolves nested refs', () => {
    const result = resolveRef(spec, '#/components/schemas/MembersList') as Record<string, unknown>;
    expect(result).toBeDefined();
    const props = result.properties as Record<string, unknown>;
    const data = props.data as Record<string, unknown>;
    // The items $ref is NOT resolved by resolveRef — it just navigates the path
    expect(data.items).toEqual({ $ref: '#/components/schemas/Member' });
  });
});

// --- resolveSchema ---

describe('resolveSchema', () => {
  const spec = makeSpec();

  it('resolves a $ref schema to its definition', () => {
    const result = resolveSchema(spec, { $ref: '#/components/schemas/Me' }) as Record<string, unknown>;
    expect(result.type).toBe('object');
    expect((result.properties as Record<string, unknown>).id).toEqual({ type: 'string' });
  });

  it('recursively resolves nested $refs', () => {
    const result = resolveSchema(spec, { $ref: '#/components/schemas/MembersList' }) as Record<string, unknown>;
    const props = result.properties as Record<string, unknown>;
    const data = props.data as Record<string, unknown>;
    // items.$ref should be resolved to the actual Member schema
    const items = data.items as Record<string, unknown>;
    expect(items.type).toBe('object');
    expect((items.properties as Record<string, unknown>).userId).toEqual({ type: 'string' });
  });

  it('returns primitives unchanged', () => {
    expect(resolveSchema(spec, 'hello')).toBe('hello');
    expect(resolveSchema(spec, 42)).toBe(42);
    expect(resolveSchema(spec, null)).toBeNull();
    expect(resolveSchema(spec, undefined)).toBeUndefined();
  });

  it('preserves arrays and resolves items within them', () => {
    const schema = { oneOf: [{ $ref: '#/components/schemas/Me' }, { type: 'null' }] };
    const result = resolveSchema(spec, schema) as Record<string, unknown>;
    const oneOf = result.oneOf as unknown[];
    expect(oneOf).toHaveLength(2);
    // First item should be the resolved Me schema
    expect((oneOf[0] as Record<string, unknown>).type).toBe('object');
    // Second item stays as-is
    expect((oneOf[1] as Record<string, unknown>).type).toBe('null');
  });

  it('handles schema with no $ref (pass-through)', () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    const result = resolveSchema(spec, schema) as Record<string, unknown>;
    expect(result.type).toBe('object');
  });

  it('returns undefined for unresolvable $ref', () => {
    const result = resolveSchema(spec, { $ref: '#/components/schemas/Missing' });
    expect(result).toBeUndefined();
  });
});

// --- extractEndpoints ---

describe('extractEndpoints', () => {
  const spec = makeSpec();

  it('extracts endpoints matching a path prefix', () => {
    const endpoints = extractEndpoints(spec, (p) => p.startsWith('/_widgets/UserProfile'));
    expect(endpoints).toHaveLength(2);
    expect(endpoints.map((e) => e.method).sort()).toEqual(['GET', 'POST']);
    expect(endpoints.every((e) => e.path === '/_widgets/UserProfile/me')).toBe(true);
  });

  it('extracts a single endpoint by exact path', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/UserManagement/members');
    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].method).toBe('GET');
    expect(endpoints[0].description).toBe('List members');
  });

  it('returns empty array when no paths match', () => {
    const endpoints = extractEndpoints(spec, () => false);
    expect(endpoints).toEqual([]);
  });

  it('returns empty array for spec with no paths', () => {
    const endpoints = extractEndpoints({ paths: undefined } as unknown as Record<string, unknown>, () => true);
    expect(endpoints).toEqual([]);
  });

  it('resolves $ref schemas in responses', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/UserProfile/me');
    const get = endpoints.find((e) => e.method === 'GET')!;
    const resp200 = get.responses['200'] as Record<string, unknown>;
    const schema = resp200.schema as Record<string, unknown>;
    // Should be the resolved Me schema, not a $ref
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['id', 'email']);
  });

  it('resolves $ref schemas in request bodies', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/UserProfile/me');
    const post = endpoints.find((e) => e.method === 'POST')!;
    expect(post.requestBody).toBeDefined();
    const body = post.requestBody as Record<string, unknown>;
    expect(body.type).toBe('object');
    expect((body.properties as Record<string, unknown>).firstName).toEqual({ type: 'string' });
  });

  it('includes parameters when present', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/UserManagement/members');
    expect(endpoints[0].parameters).toHaveLength(2);
  });

  it('handles responses without content/schema', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/admin-portal/sso-connections');
    const get = endpoints[0];
    const resp200 = get.responses['200'] as Record<string, unknown>;
    expect(resp200.description).toBe('OK');
    expect(resp200.schema).toBeUndefined();
  });

  it('includes inline error response schemas', () => {
    const endpoints = extractEndpoints(spec, (p) => p === '/_widgets/UserProfile/me');
    const get = endpoints.find((e) => e.method === 'GET')!;
    const resp403 = get.responses['403'] as Record<string, unknown>;
    const schema = resp403.schema as Record<string, unknown>;
    expect(schema.type).toBe('object');
    expect((schema.properties as Record<string, unknown>).message).toEqual({ type: 'string' });
  });
});

// --- formatEndpoint ---

describe('formatEndpoint', () => {
  it('formats a basic GET endpoint', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/UserProfile/me',
      method: 'GET',
      description: 'Returns the current user profile',
      responses: {
        '200': { description: 'OK', schema: { type: 'object' } },
      },
    };
    const output = formatEndpoint(ep);
    expect(output).toContain('## GET /_widgets/UserProfile/me');
    expect(output).toContain('Returns the current user profile');
    expect(output).toContain('### Response 200 — OK');
    expect(output).toContain('```json');
  });

  it('formats request body', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/UserProfile/me',
      method: 'POST',
      requestBody: { type: 'object', properties: { firstName: { type: 'string' } } },
      responses: {},
    };
    const output = formatEndpoint(ep);
    expect(output).toContain('### Request Body');
    expect(output).toContain('"firstName"');
  });

  it('formats parameters', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/UserManagement/members',
      method: 'GET',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
      responses: {},
    };
    const output = formatEndpoint(ep);
    expect(output).toContain('### Parameters');
    expect(output).toContain('`limit` (query)');
  });

  it('omits description when not present', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/settings',
      method: 'GET',
      responses: { '200': { description: 'OK' } },
    };
    const output = formatEndpoint(ep);
    const lines = output.split('\n');
    // Second line should be empty or the response, not a description
    expect(lines[0]).toBe('## GET /_widgets/settings');
  });

  it('omits parameters section when empty', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/settings',
      method: 'GET',
      parameters: [],
      responses: {},
    };
    const output = formatEndpoint(ep);
    expect(output).not.toContain('### Parameters');
  });

  it('handles response without schema', () => {
    const ep: EndpointInfo = {
      path: '/_widgets/settings',
      method: 'GET',
      responses: { '200': { description: 'OK' } },
    };
    const output = formatEndpoint(ep);
    expect(output).toContain('### Response 200 — OK');
    expect(output).not.toContain('```json');
  });
});

// --- groupPathsByWidget ---

describe('groupPathsByWidget', () => {
  it('groups paths by their first two segments', () => {
    const paths = [
      '/_widgets/UserProfile/me',
      '/_widgets/UserProfile/sessions',
      '/_widgets/UserManagement/members',
      '/_widgets/settings',
    ];
    const grouped = groupPathsByWidget(paths);
    expect(grouped['_widgets/UserProfile']).toHaveLength(2);
    expect(grouped['_widgets/UserManagement']).toHaveLength(1);
    expect(grouped['_widgets/settings']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(groupPathsByWidget([])).toEqual({});
  });
});

// --- WIDGET_PREFIXES ---

describe('WIDGET_PREFIXES', () => {
  it('has entries for all core widgets', () => {
    expect(WIDGET_PREFIXES['usermanagement']).toBe('/_widgets/UserManagement');
    expect(WIDGET_PREFIXES['userprofile']).toBe('/_widgets/UserProfile');
    expect(WIDGET_PREFIXES['admin-portal']).toBe('/_widgets/admin-portal');
    expect(WIDGET_PREFIXES['adminportal']).toBe('/_widgets/admin-portal');
  });

  it('has alias entries for sub-widgets', () => {
    expect(WIDGET_PREFIXES['sso-connection']).toContain('sso-connections');
    expect(WIDGET_PREFIXES['domain-verification']).toContain('organization-domains');
  });

  it('all prefixes start with /_widgets/', () => {
    for (const prefix of Object.values(WIDGET_PREFIXES)) {
      expect(prefix).toMatch(/^\/_widgets\//);
    }
  });
});

// --- Integration: loadSpec + extractEndpoints against real spec ---

describe('integration with real spec', () => {
  const spec = loadSpec();

  it('loads the real spec with paths', () => {
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(30);
  });

  it('all WIDGET_PREFIXES match at least one path in the real spec', () => {
    const allPaths = Object.keys(spec.paths);
    const uniquePrefixes = new Set(Object.values(WIDGET_PREFIXES));
    for (const prefix of uniquePrefixes) {
      const matches = allPaths.filter((p) => p.startsWith(prefix));
      expect(matches.length, `prefix "${prefix}" should match at least one path`).toBeGreaterThan(0);
    }
  });

  it('UserProfile filter returns 14+ endpoints from real spec', () => {
    const endpoints = extractEndpoints(spec, (p) => p.startsWith('/_widgets/UserProfile'));
    expect(endpoints.length).toBeGreaterThanOrEqual(14);
  });

  it('UserManagement filter returns 8+ endpoints from real spec', () => {
    const endpoints = extractEndpoints(spec, (p) => p.startsWith('/_widgets/UserManagement'));
    expect(endpoints.length).toBeGreaterThanOrEqual(8);
  });

  it('admin-portal filter returns 4+ endpoints from real spec', () => {
    const endpoints = extractEndpoints(spec, (p) => p.startsWith('/_widgets/admin-portal'));
    expect(endpoints.length).toBeGreaterThanOrEqual(4);
  });

  it('resolved schemas have no remaining $ref keys', () => {
    const endpoints = extractEndpoints(spec, (p) => p.startsWith('/_widgets/UserProfile/me'));
    const get = endpoints.find((e) => e.method === 'GET')!;
    const resp200 = get.responses['200'] as Record<string, unknown>;
    const json = JSON.stringify(resp200.schema);
    expect(json).not.toContain('$ref');
  });
});
