import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Shared OpenAPI assertions for the HTTP suites. Not named *.test.ts, so the test glob skips it
// while tsconfig and ESLint still cover it.
export interface JsonObject {
  [key: string]: unknown;
}

export interface HttpResult {
  status: number;
  body: unknown;
}

export function object(value: unknown): JsonObject {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return value as JsonObject;
}

const contract = object(JSON.parse(readFileSync('docs/openapi.json', 'utf8')) as unknown);
const schemas = object(object(contract.components).schemas);

export function schema(name: string): unknown {
  const found = schemas[name];
  assert.ok(found !== undefined, `Unknown schema ${name}`);
  return found;
}

// This checks the schema features used by our responses, not arbitrary OpenAPI documents.
// Redocly separately validates the complete OpenAPI specification.
export function matchesSchema(value: unknown, rawSchema: unknown): void {
  const node = object(rawSchema);
  if (typeof node.$ref === 'string') {
    const name = node.$ref.split('/').at(-1);
    assert.ok(name);
    matchesSchema(value, schemas[name]);
    return;
  }
  if (Array.isArray(node.enum)) assert.ok(node.enum.includes(value));
  if (node.type === 'array') {
    assert.ok(Array.isArray(value));
    for (const item of value) matchesSchema(item, node.items);
  } else if (node.type === 'object') {
    const record = object(value);
    const properties = object(node.properties);
    assert.ok(Array.isArray(node.required));
    for (const key of node.required) {
      assert.equal(typeof key, 'string');
      assert.ok(Object.hasOwn(record, String(key)), `Missing ${String(key)}`);
    }
    for (const [key, field] of Object.entries(record)) {
      if (node.additionalProperties === false) assert.ok(Object.hasOwn(properties, key));
      matchesSchema(field, properties[key]);
    }
  } else if (node.type === 'string') {
    assert.ok(typeof value === 'string');
    if (typeof node.minLength === 'number') assert.ok(value.length >= node.minLength);
    if (typeof node.maxLength === 'number') assert.ok(value.length <= node.maxLength);
    if (typeof node.pattern === 'string') assert.match(value, new RegExp(node.pattern));
    if (node.format === 'date-time') assert.ok(Number.isFinite(Date.parse(value)));
    if (node.format === 'uuid') {
      assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  } else {
    assert.equal(node.type, 'boolean');
    assert.equal(typeof value, 'boolean');
  }
}

// Asserts that a live response matches the documented body for its exact status code, which also
// fails when an endpoint returns a status the contract never declared.
export function assertResponse(result: HttpResult, path: string, method: string): void {
  const operation = object(object(object(contract.paths)[path])[method]);
  let response = object(object(operation.responses)[String(result.status)]);
  if (typeof response.$ref === 'string') {
    const name = response.$ref.split('/').at(-1);
    assert.ok(name);
    response = object(object(object(contract.components).responses)[name]);
  }
  matchesSchema(result.body, object(object(response.content)['application/json']).schema);
}
