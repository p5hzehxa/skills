#!/usr/bin/env npx tsx
/**
 * Strips boilerplate from the WorkOS Widgets OpenAPI spec:
 * - Removes `x-internal` and `x-api-client` fields from operations
 * - Removes empty `summary: ''` fields from operations
 * - Replaces inline error response schemas (400/403/404/422 with {message: string})
 *   with a $ref to a shared ErrorResponse schema
 *
 * Run: npx tsx scripts/strip-openapi-spec.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, '../plugins/workos/skills/workos-widgets/references/widgets-open-api-spec.yaml');

const raw = readFileSync(SPEC_PATH, 'utf-8');
const beforeLines = raw.split('\n').length;

const spec = parse(raw);

// Shared error response schema to replace inline duplicates
const ERROR_SCHEMA = {
  type: 'object',
  properties: { message: { type: 'string' } },
  required: ['message'],
};

function isInlineErrorSchema(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const s = schema as Record<string, unknown>;
  return (
    s.type === 'object' &&
    typeof s.properties === 'object' &&
    s.properties !== null &&
    Object.keys(s.properties as object).length === 1 &&
    (s.properties as Record<string, unknown>).message !== undefined &&
    Array.isArray(s.required) &&
    s.required.length === 1 &&
    s.required[0] === 'message'
  );
}

const ERROR_CODES = new Set(['400', '403', '404', '422']);

let replacedCount = 0;

// Process all paths and operations
for (const [, methods] of Object.entries(spec.paths ?? {})) {
  for (const [_method, operation] of Object.entries(methods as Record<string, unknown>)) {
    if (!operation || typeof operation !== 'object') continue;
    const op = operation as Record<string, unknown>;

    // Remove x-internal, x-api-client
    delete op['x-internal'];
    delete op['x-api-client'];

    // Remove empty summary
    if (op.summary === '') {
      delete op.summary;
    }

    // Replace inline error schemas with $ref
    const responses = op.responses as Record<string, unknown> | undefined;
    if (!responses) continue;

    for (const code of ERROR_CODES) {
      const resp = responses[code] as Record<string, unknown> | undefined;
      if (!resp?.content) continue;

      const content = resp.content as Record<string, unknown>;
      const json = content['application/json'] as Record<string, unknown> | undefined;
      if (!json?.schema) continue;

      if (isInlineErrorSchema(json.schema)) {
        json.schema = { $ref: '#/components/schemas/ErrorResponse' };
        replacedCount++;
      }
    }
  }
}

// Add shared ErrorResponse schema
if (!spec.components) spec.components = {};
if (!spec.components.schemas) spec.components.schemas = {};
spec.components.schemas.ErrorResponse = ERROR_SCHEMA;

const output = stringify(spec, { lineWidth: 0 });
writeFileSync(SPEC_PATH, output, 'utf-8');

const afterLines = output.split('\n').length;

console.log(`Before: ${beforeLines} lines`);
console.log(`After:  ${afterLines} lines`);
console.log(
  `Saved:  ${beforeLines - afterLines} lines (${Math.round(((beforeLines - afterLines) / beforeLines) * 100)}%)`,
);
console.log(`Replaced ${replacedCount} inline error schemas with $ref`);
