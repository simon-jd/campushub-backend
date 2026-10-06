import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import mongoose from 'mongoose';
import { app, connectDatabase, disconnectDatabase } from '../app';
import { loadConfig } from '../config/environment';
import { seedResources } from '../services/resource.service';
import type { Resource } from '../types/reservation';

interface JsonObject {
  [key: string]: unknown;
}

interface HttpResult {
  status: number;
  body: unknown;
}

function object(value: unknown): JsonObject {
  assert.ok(typeof value === 'object' && value !== null && !Array.isArray(value));
  return value as JsonObject;
}

// Lab 2 resource IDs (res-101 to res-104) become fixed ObjectIds under MongoDB persistence.
const ROOM_ID = '000000000000000000000101';
const EQUIPMENT_ID = '000000000000000000000102';
const UNAVAILABLE_ID = '000000000000000000000104';
const ABSENT_ID = '0000000000000000000009ff';

const fixtures: readonly Resource[] = [
  {
    id: ROOM_ID,
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
  },
  {
    id: EQUIPMENT_ID,
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Makerspace',
    isAvailable: true,
  },
  {
    id: '000000000000000000000103',
    name: 'Computer Lab 201',
    type: 'LAB',
    location: 'Science Building, Floor 2',
    isAvailable: true,
  },
  {
    id: UNAVAILABLE_ID,
    name: 'Study Room 304',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: false,
  },
];

const contract = object(JSON.parse(readFileSync('docs/openapi.json', 'utf8')) as unknown);
const schemas = object(object(contract.components).schemas);

// This checks the schema features used by our responses, not arbitrary OpenAPI documents.
// Redocly separately validates the complete OpenAPI specification.
function matchesSchema(value: unknown, rawSchema: unknown): void {
  const schema = object(rawSchema);
  if (typeof schema.$ref === 'string') {
    const name = schema.$ref.split('/').at(-1);
    assert.ok(name);
    matchesSchema(value, schemas[name]);
    return;
  }
  if (Array.isArray(schema.enum)) assert.ok(schema.enum.includes(value));
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value));
    for (const item of value) matchesSchema(item, schema.items);
  } else if (schema.type === 'object') {
    const record = object(value);
    const properties = object(schema.properties);
    assert.ok(Array.isArray(schema.required));
    for (const key of schema.required) {
      assert.equal(typeof key, 'string');
      assert.ok(Object.hasOwn(record, String(key)), `Missing ${String(key)}`);
    }
    for (const [key, field] of Object.entries(record)) {
      if (schema.additionalProperties === false) assert.ok(Object.hasOwn(properties, key));
      matchesSchema(field, properties[key]);
    }
  } else if (schema.type === 'string') {
    assert.equal(typeof value, 'string');
    assert.ok(typeof value === 'string');
    if (typeof schema.minLength === 'number') assert.ok(value.length >= schema.minLength);
    if (typeof schema.maxLength === 'number') assert.ok(value.length <= schema.maxLength);
    if (typeof schema.pattern === 'string') assert.match(value, new RegExp(schema.pattern));
    if (schema.format === 'date-time') assert.ok(Number.isFinite(Date.parse(value)));
    if (schema.format === 'uuid') {
      assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  } else {
    assert.equal(schema.type, 'boolean');
    assert.equal(typeof value, 'boolean');
  }
}

function assertResponse(result: HttpResult, path: string, method: string): void {
  const operation = object(object(object(contract.paths)[path])[method]);
  let response = object(object(operation.responses)[String(result.status)]);
  if (typeof response.$ref === 'string') {
    const name = response.$ref.split('/').at(-1);
    assert.ok(name);
    response = object(object(object(contract.components).responses)[name]);
  }
  matchesSchema(result.body, object(object(response.content)['application/json']).schema);
}

test('Lab 2 HTTP contract', async (context: TestContext): Promise<void> => {
  // A per-process database on the configured server keeps development data untouched.
  const { database } = loadConfig(process.env);
  await connectDatabase({ uri: database.uri, dbName: `campushub_test_${process.pid}` });
  context.after(async (): Promise<void> => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });
  assert.equal((await seedResources(fixtures)).length, fixtures.length);

  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  context.after(async (): Promise<void> => {
    await new Promise<void>((resolve, reject): void => {
      server.close((error?: Error): void => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  async function request(
    path: string,
    method: string = 'GET',
    body?: unknown,
    contentType: string = 'application/json',
    extraHeaders: Record<string, string> = {},
  ): Promise<HttpResult> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': contentType, ...extraHeaders },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
    const result: HttpResult = {
      status: response.status,
      body: (await response.json()) as unknown,
    };
    if (path.startsWith('/resources')) assertResponse(result, '/resources', 'get');
    if (path.startsWith('/reservations/user/')) {
      assertResponse(result, '/reservations/user/{userId}', 'get');
    } else if (path.startsWith('/reservations')) {
      assertResponse(result, '/reservations', 'post');
    }
    if (path === '/health') assertResponse(result, '/health', 'get');
    return result;
  }

  const booking: JsonObject = {
    resourceId: ROOM_ID,
    userId: 'user-456',
    startTime: '2099-10-01T10:00:00Z',
    endTime: '2099-10-01T11:00:00Z',
  };

  await context.test(
    'health and unknown routes use direct contract JSON',
    async (): Promise<void> => {
      const health = await request('/health');
      assert.equal(health.status, 200);
      assert.equal(object(health.body).status, 'ok');
      const missing = await request('/missing');
      assert.equal(missing.status, 404);
      matchesSchema(missing.body, schemas.ErrorResponse);
      assert.equal(object(missing.body).code, 'NOT_FOUND');
    },
  );

  await context.test(
    'catalog supports every type and the assignment alias',
    async (): Promise<void> => {
      const all = await request('/resources');
      assert.equal(all.status, 200);
      assert.deepEqual(all.body, fixtures);
      for (const type of ['ROOM', 'EQUIPMENT', 'LAB']) {
        const filtered = await request(`/resources?type=${type}`);
        assert.equal(filtered.status, 200);
        assert.ok(Array.isArray(filtered.body) && filtered.body.length > 0);
        for (const resource of filtered.body) assert.equal(object(resource).type, type);
      }
      assert.deepEqual(
        (await request('/resources?type=STUDY_ROOM')).body,
        (await request('/resources?type=ROOM')).body,
      );
    },
  );

  await context.test('invalid or ambiguous filters fail explicitly', async (): Promise<void> => {
    for (const query of [
      'type=',
      'type=%20',
      'type=BOGUS',
      'type=room',
      'type=ROOM&type=LAB',
      'type[x]=ROOM',
      'unexpected=1',
    ]) {
      const result = await request(`/resources?${query}`);
      assert.equal(result.status, 400, query);
      assert.equal(object(result.body).code, 'VALIDATION_ERROR');
    }
  });

  await context.test(
    'creation returns server fields and is observable for that user only',
    async (): Promise<void> => {
      const result = await request('/reservations', 'POST', booking);
      assert.equal(result.status, 201);
      const created = object(result.body);
      assert.equal(created.status, 'CONFIRMED');
      assert.equal(created.startTime, '2099-10-01T10:00:00.000Z');
      assert.equal(created.resourceId, ROOM_ID);
      assert.equal(typeof created.id, 'string');
      // The record lives in MongoDB with the resource reference stored as an ObjectId.
      const stored = await mongoose.connection
        .collection('reservations')
        .findOne({ _id: new mongoose.Types.ObjectId(String(created.id)) });
      assert.ok(stored !== null && stored.resourceId instanceof mongoose.Types.ObjectId);
      assert.ok(stored.startTime instanceof Date);
      const mine = await request('/reservations/user/user-456');
      assert.equal(mine.status, 200);
      assert.deepEqual(mine.body, [created]);
      assert.deepEqual((await request('/reservations/user/someone-else')).body, []);
    },
  );

  await context.test(
    'duplicate, partial, enclosing, contained and offset-equivalent overlaps conflict',
    async (): Promise<void> => {
      const intervals = [
        ['2099-10-01T10:00:00Z', '2099-10-01T11:00:00Z'],
        ['2099-10-01T09:30:00Z', '2099-10-01T10:30:00Z'],
        ['2099-10-01T10:30:00Z', '2099-10-01T11:30:00Z'],
        ['2099-10-01T09:00:00Z', '2099-10-01T12:00:00Z'],
        ['2099-10-01T10:15:00Z', '2099-10-01T10:45:00Z'],
        ['2099-10-01T12:00:00+02:00', '2099-10-01T13:00:00+02:00'],
      ];
      for (const [startTime, endTime] of intervals) {
        const result = await request('/reservations', 'POST', {
          ...booking,
          userId: 'other-user',
          startTime,
          endTime,
        });
        assert.equal(result.status, 409);
        assert.equal(object(result.body).code, 'DOUBLE_BOOKING');
      }
      assert.deepEqual((await request('/reservations/user/other-user')).body, []);
    },
  );

  await context.test(
    'adjacent slots and another resource remain bookable',
    async (): Promise<void> => {
      for (const changes of [
        { startTime: '2099-10-01T09:00:00Z', endTime: '2099-10-01T10:00:00Z' },
        { startTime: '2099-10-01T11:00:00Z', endTime: '2099-10-01T12:00:00Z' },
        { resourceId: EQUIPMENT_ID },
      ])
        assert.equal(
          (await request('/reservations', 'POST', { ...booking, ...changes })).status,
          201,
        );
    },
  );

  await context.test(
    'simultaneous requests produce exactly one reservation',
    async (): Promise<void> => {
      const fresh = {
        ...booking,
        startTime: '2099-10-02T10:00:00Z',
        endTime: '2099-10-02T11:00:00Z',
      };
      const results = await Promise.all(
        Array.from({ length: 5 }, (): Promise<HttpResult> =>
          request('/reservations', 'POST', fresh),
        ),
      );
      assert.deepEqual(
        results.map((result: HttpResult): number => result.status).sort(),
        [201, 409, 409, 409, 409],
      );
    },
  );

  await context.test(
    'missing, extra and mistyped body fields are rejected',
    async (): Promise<void> => {
      const invalid: unknown[] = [
        null,
        [],
        3,
        {},
        { ...booking, resourceId: '' },
        { ...booking, userId: ' ' },
        { ...booking, userId: 42 },
        { ...booking, userId: 'x'.repeat(65) },
        { ...booking, status: 'CANCELLED' },
        { ...booking, id: 'client-id' },
      ];
      for (const field of Object.keys(booking)) {
        const incomplete = { ...booking };
        delete incomplete[field];
        invalid.push(incomplete);
      }
      for (const body of invalid) {
        const result = await request('/reservations', 'POST', body);
        assert.equal(result.status, 400, JSON.stringify(body));
      }
    },
  );

  await context.test(
    'invalid calendar dates, timezones and intervals return 400',
    async (): Promise<void> => {
      const invalidDates = [
        'not-a-date',
        '2099-10-01',
        '2099-10-01T10:00:00',
        '2099-02-29T10:00:00Z',
        '2100-02-29T10:00:00Z',
        '2099-04-31T10:00:00Z',
        '2099-13-01T10:00:00Z',
        '2099-10-01T24:00:00Z',
        '2099-10-01T10:00:60Z',
        '2099-10-01T10:00:00+24:00',
        '2099-10-01T10:00:00.1234Z',
        '0000-01-01T00:00:00Z',
      ];
      for (const startTime of invalidDates) {
        assert.equal(
          (await request('/reservations', 'POST', { ...booking, startTime })).status,
          400,
          startTime,
        );
      }
      for (const endTime of [
        '2099-10-01T10:00:00Z',
        '2099-10-01T09:00:00Z',
        '2099-10-01T12:00:00+03:00',
      ]) {
        assert.equal((await request('/reservations', 'POST', { ...booking, endTime })).status, 400);
      }
      const leap = await request('/reservations', 'POST', {
        ...booking,
        startTime: '2096-02-29T10:00:00.1-05:00',
        endTime: '2096-02-29T11:00:00.12-05:00',
      });
      assert.equal(leap.status, 201);
      assert.equal(object(leap.body).startTime, '2096-02-29T15:00:00.100Z');
    },
  );

  await context.test(
    'missing or unavailable resources fail without creating bookings',
    async (): Promise<void> => {
      const before = (await request('/reservations/user/user-456')).body;
      for (const resourceId of ['missing', 'res-101', ABSENT_ID]) {
        const missing = await request('/reservations', 'POST', { ...booking, resourceId });
        assert.equal(missing.status, 404, resourceId);
        assert.equal(object(missing.body).code, 'RESOURCE_NOT_FOUND');
      }
      const unavailable = await request('/reservations', 'POST', {
        ...booking,
        resourceId: UNAVAILABLE_ID,
      });
      assert.equal(unavailable.status, 409);
      assert.equal(object(unavailable.body).code, 'RESOURCE_UNAVAILABLE');
      assert.deepEqual((await request('/reservations/user/user-456')).body, before);
    },
  );

  await context.test(
    'expired reservations are excluded and invalid user paths fail',
    async (): Promise<void> => {
      const past = {
        ...booking,
        userId: 'past-user',
        startTime: '2000-01-01T10:00:00Z',
        endTime: '2000-01-01T11:00:00Z',
      };
      assert.equal((await request('/reservations', 'POST', past)).status, 201);
      assert.deepEqual((await request('/reservations/user/past-user')).body, []);
      for (const path of [
        '/reservations/user/%20',
        '/reservations/user/a%2Fb',
        '/reservations/user/user-456?extra=1',
      ]) {
        assert.equal((await request(path)).status, 400);
      }
    },
  );

  await context.test(
    'JSON parser and media errors remain safe contract errors',
    async (): Promise<void> => {
      assert.equal((await request('/reservations', 'POST', '{')).status, 400);
      assert.equal((await request('/reservations', 'POST')).status, 400);
      assert.equal((await request('/reservations', 'POST', booking, 'text/plain')).status, 415);
      assert.equal(
        (await request('/reservations', 'POST', { ...booking, userId: 'x'.repeat(17000) })).status,
        413,
      );
      assert.equal((await request('/reservations?extra=1', 'POST', booking)).status, 400);
    },
  );
  await context.test(
    'unsupported compressed bodies return 415 rather than an internal error',
    async (): Promise<void> => {
      const result = await request('/reservations', 'POST', 'not-gzip', 'application/json', {
        'Content-Encoding': 'gzip',
      });
      assert.equal(result.status, 415);
      assert.equal(object(result.body).code, 'UNSUPPORTED_MEDIA_TYPE');
    },
  );

  await context.test('JSON parsing is limited to the creation route', async (): Promise<void> => {
    for (const path of ['/health', '/resources', '/reservations/user/user-456']) {
      const result = await new Promise<HttpResult>((resolve, reject): void => {
        const outgoing = httpRequest(
          `${base}${path}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json', 'Content-Length': '1' } },
          (incoming: IncomingMessage): void => {
            let body = '';
            incoming.setEncoding('utf8');
            incoming.on('data', (chunk: string): void => {
              body += chunk;
            });
            incoming.on('error', reject);
            incoming.on('end', (): void => {
              try {
                resolve({ status: incoming.statusCode ?? 0, body: JSON.parse(body) as unknown });
              } catch (error: unknown) {
                reject(
                  error instanceof Error
                    ? error
                    : new Error('Unable to decode response.', { cause: error }),
                );
              }
            });
          },
        );
        outgoing.on('error', reject);
        outgoing.end('{');
      });
      assert.equal(result.status, 200, path);
    }
    assert.equal((await request('/missing', 'POST', '{')).status, 404);
  });
}).catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
