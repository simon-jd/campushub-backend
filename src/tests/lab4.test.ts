import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import mongoose from 'mongoose';
import { app, connectDatabase, disconnectDatabase } from '../app';
import { loadConfig } from '../config/environment';
import { seedReservations } from '../services/reservation.service';
import { seedResources } from '../services/resource.service';
import type { Reservation, Resource } from '../types/reservation';
import { assertResponse, object } from './contract.helper';
import type { HttpResult, JsonObject } from './contract.helper';

const ROOM_ID = '000000000000000000000101';
const EQUIPMENT_ID = '000000000000000000000102';
const LAB_ID = '000000000000000000000103';
const UNAVAILABLE_ROOM_ID = '000000000000000000000104';
const PENDING_ID = '000000000000000000000201';
const PENDING_BLOCKER_ID = '000000000000000000000202';
const ABSENT_RESERVATION_ID = '0000000000000000000009fe';

const resources: readonly Resource[] = [
  { id: ROOM_ID, name: 'Study Room 302', type: 'ROOM', location: 'Library', isAvailable: true },
  {
    id: EQUIPMENT_ID,
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Maker',
    isAvailable: true,
  },
  { id: LAB_ID, name: 'Computer Lab 201', type: 'LAB', location: 'Science', isAvailable: true },
  {
    id: UNAVAILABLE_ROOM_ID,
    name: 'Study Room 304',
    type: 'ROOM',
    location: 'Library',
    isAvailable: false,
  },
];

// PENDING bookings cannot be created over HTTP, so the two below are seeded. One exercises the
// confirm transition; the other proves a PENDING reservation still blocks an overlapping request.
const pendingReservations: readonly Reservation[] = [
  {
    id: PENDING_ID,
    resourceId: LAB_ID,
    userId: 'pending-user',
    startTime: '2099-12-31T09:00:00.000Z',
    endTime: '2099-12-31T10:00:00.000Z',
    status: 'PENDING',
  },
  {
    id: PENDING_BLOCKER_ID,
    resourceId: EQUIPMENT_ID,
    userId: 'pending-user',
    startTime: '2099-11-01T09:00:00.000Z',
    endTime: '2099-11-01T10:00:00.000Z',
    status: 'PENDING',
  },
];

// Maps a request to the contract operation that documents it, so every response below is checked
// against docs/openapi.json for its exact status code.
function operationFor(path: string, method: string): readonly [string, string] | null {
  const route = path.split('?')[0] ?? '';
  if (route === '/resources') return ['/resources', 'get'];
  if (route === '/reservations' && method === 'POST') return ['/reservations', 'post'];
  if (route.startsWith('/reservations/user/')) return ['/reservations/user/{userId}', 'get'];
  if (/^\/reservations\/[^/]+\/cancel$/.test(route)) return ['/reservations/{id}/cancel', 'patch'];
  if (/^\/reservations\/[^/]+\/confirm$/.test(route)) {
    return ['/reservations/{id}/confirm', 'patch'];
  }
  return null;
}

test('Lab 4 reservation engine', async (context: TestContext): Promise<void> => {
  const { database } = loadConfig(process.env);
  await connectDatabase({ uri: database.uri, dbName: `campushub_lab4_${process.pid}` });
  context.after(async (): Promise<void> => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });
  assert.equal((await seedResources(resources)).length, resources.length);
  assert.equal((await seedReservations(pendingReservations)).length, pendingReservations.length);

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
  ): Promise<HttpResult> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result: HttpResult = {
      status: response.status,
      body: (await response.json()) as unknown,
    };
    const operation = operationFor(path, method);
    if (operation) assertResponse(result, operation[0], operation[1]);
    return result;
  }

  function ids(body: unknown): string[] {
    assert.ok(Array.isArray(body));
    return body.map((item: unknown): string => String(object(item).id));
  }

  const booking: JsonObject = {
    resourceId: ROOM_ID,
    userId: 'student-1',
    startTime: '2099-10-01T10:00:00Z',
    endTime: '2099-10-01T11:00:00Z',
  };

  await context.test('catalog filters by availability alone', async (): Promise<void> => {
    const available = await request('/resources?isAvailable=true');
    assert.equal(available.status, 200);
    assert.deepEqual(ids(available.body), [ROOM_ID, EQUIPMENT_ID, LAB_ID]);

    const unavailable = await request('/resources?isAvailable=false');
    assert.equal(unavailable.status, 200);
    assert.deepEqual(ids(unavailable.body), [UNAVAILABLE_ROOM_ID]);
  });

  await context.test('type and availability narrow together', async (): Promise<void> => {
    assert.deepEqual(ids((await request('/resources?type=ROOM&isAvailable=true')).body), [ROOM_ID]);
    assert.deepEqual(ids((await request('/resources?type=ROOM&isAvailable=false')).body), [
      UNAVAILABLE_ROOM_ID,
    ]);
    // The STUDY_ROOM alias must keep working alongside the new filter.
    assert.deepEqual(ids((await request('/resources?type=STUDY_ROOM&isAvailable=false')).body), [
      UNAVAILABLE_ROOM_ID,
    ]);
    // A combination with no members is an empty list, not an error.
    const none = await request('/resources?type=LAB&isAvailable=false');
    assert.equal(none.status, 200);
    assert.deepEqual(none.body, []);
  });

  await context.test('non-boolean availability values are rejected', async (): Promise<void> => {
    for (const query of [
      'isAvailable=',
      'isAvailable=TRUE',
      'isAvailable=True',
      'isAvailable=1',
      'isAvailable=yes',
      'isAvailable=%20true',
      'isAvailable=true&isAvailable=false',
      'isAvailable[x]=true',
      'type=ROOM&available=true',
    ]) {
      const result = await request(`/resources?${query}`);
      assert.equal(result.status, 400, query);
      assert.equal(object(result.body).code, 'VALIDATION_ERROR');
    }
  });

  await context.test(
    'a pending reservation blocks an overlapping slot',
    async (): Promise<void> => {
      const result = await request('/reservations', 'POST', {
        ...booking,
        resourceId: EQUIPMENT_ID,
        startTime: '2099-11-01T09:30:00Z',
        endTime: '2099-11-01T10:30:00Z',
      });
      assert.equal(result.status, 409);
      assert.equal(object(result.body).code, 'DOUBLE_BOOKING');
    },
  );

  let cancelledId = '';
  await context.test('cancelling a reservation frees its slot', async (): Promise<void> => {
    const created = await request('/reservations', 'POST', booking);
    assert.equal(created.status, 201);
    const id = String(object(created.body).id);

    // The same window is refused while the booking is active.
    const blocked = await request('/reservations', 'POST', { ...booking, userId: 'student-2' });
    assert.equal(blocked.status, 409);
    assert.equal(object(blocked.body).code, 'DOUBLE_BOOKING');

    const cancelled = await request(`/reservations/${id}/cancel`, 'PATCH');
    assert.equal(cancelled.status, 200);
    assert.equal(object(cancelled.body).status, 'CANCELLED');
    assert.equal(object(cancelled.body).id, id);
    // Only the status changed; the stored interval and owner are untouched.
    assert.equal(object(cancelled.body).userId, 'student-1');
    assert.equal(object(cancelled.body).startTime, '2099-10-01T10:00:00.000Z');

    // The released interval stops blocking immediately.
    const rebooked = await request('/reservations', 'POST', { ...booking, userId: 'student-2' });
    assert.equal(rebooked.status, 201);
    assert.equal(object(rebooked.body).status, 'CONFIRMED');
    cancelledId = id;
  });

  await context.test('cancellation refuses invalid targets', async (): Promise<void> => {
    // CANCELLED is terminal, so a second cancellation is a conflict rather than a silent no-op.
    const again = await request(`/reservations/${cancelledId}/cancel`, 'PATCH');
    assert.equal(again.status, 409);
    assert.equal(object(again.body).code, 'INVALID_STATE_TRANSITION');

    for (const id of [ABSENT_RESERVATION_ID, 'not-an-object-id', ROOM_ID]) {
      const missing = await request(`/reservations/${id}/cancel`, 'PATCH');
      assert.equal(missing.status, 404, id);
      assert.equal(object(missing.body).code, 'RESERVATION_NOT_FOUND');
    }

    const extra = await request(`/reservations/${cancelledId}/cancel?force=1`, 'PATCH');
    assert.equal(extra.status, 400);
    assert.equal(object(extra.body).code, 'VALIDATION_ERROR');
  });

  await context.test(
    'confirmation promotes a pending reservation once',
    async (): Promise<void> => {
      const confirmed = await request(`/reservations/${PENDING_ID}/confirm`, 'PATCH');
      assert.equal(confirmed.status, 200);
      assert.equal(object(confirmed.body).status, 'CONFIRMED');

      // Confirming twice is a conflict: CONFIRMED is not a legal source for its own transition.
      const twice = await request(`/reservations/${PENDING_ID}/confirm`, 'PATCH');
      assert.equal(twice.status, 409);
      assert.equal(object(twice.body).code, 'INVALID_STATE_TRANSITION');

      const cancelled = await request(`/reservations/${PENDING_ID}/cancel`, 'PATCH');
      assert.equal(cancelled.status, 200);
      assert.equal(object(cancelled.body).status, 'CANCELLED');

      // A cancelled reservation can never be revived through confirm.
      const revived = await request(`/reservations/${PENDING_ID}/confirm`, 'PATCH');
      assert.equal(revived.status, 409);

      const missing = await request(`/reservations/${ABSENT_RESERVATION_ID}/confirm`, 'PATCH');
      assert.equal(missing.status, 404);
      assert.equal(object(missing.body).code, 'RESERVATION_NOT_FOUND');
    },
  );

  await context.test(
    'a pending reservation stops blocking once cancelled',
    async (): Promise<void> => {
      const result = await request('/reservations', 'POST', {
        ...booking,
        resourceId: LAB_ID,
        userId: 'student-3',
        startTime: '2099-12-31T09:00:00Z',
        endTime: '2099-12-31T10:00:00Z',
      });
      assert.equal(result.status, 201);
    },
  );

  await context.test('the user listing keeps every status', async (): Promise<void> => {
    const all = await request('/reservations/user/student-1');
    assert.equal(all.status, 200);
    // The cancelled booking is still listed rather than disappearing from the student's history.
    assert.deepEqual(ids(all.body), [cancelledId]);
    assert.ok(Array.isArray(all.body));
    assert.equal(object(all.body[0]).status, 'CANCELLED');

    const owner = await request('/reservations/user/pending-user');
    assert.deepEqual(ids(owner.body), [PENDING_ID, PENDING_BLOCKER_ID]);
    assert.deepEqual(ids((await request('/reservations/user/pending-user?status=PENDING')).body), [
      PENDING_BLOCKER_ID,
    ]);
    assert.deepEqual(
      ids((await request('/reservations/user/pending-user?status=CANCELLED')).body),
      [PENDING_ID],
    );
    assert.deepEqual((await request('/reservations/user/pending-user?status=CONFIRMED')).body, []);
  });

  await context.test('the status filter rejects anything else', async (): Promise<void> => {
    for (const query of [
      'status=',
      'status=BOGUS',
      'status=pending',
      'status=PENDING&status=CONFIRMED',
      'status[x]=PENDING',
      'status=PENDING&extra=1',
    ]) {
      const result = await request(`/reservations/user/pending-user?${query}`);
      assert.equal(result.status, 400, query);
      assert.equal(object(result.body).code, 'VALIDATION_ERROR');
    }
  });

  await context.test('concurrent cancellations produce one winner', async (): Promise<void> => {
    const created = await request('/reservations', 'POST', {
      ...booking,
      userId: 'race-user',
      startTime: '2099-10-05T10:00:00Z',
      endTime: '2099-10-05T11:00:00Z',
    });
    assert.equal(created.status, 201);
    const id = String(object(created.body).id);
    const results = await Promise.all(
      Array.from({ length: 4 }, (): Promise<HttpResult> =>
        request(`/reservations/${id}/cancel`, 'PATCH'),
      ),
    );
    assert.deepEqual(
      results.map((result: HttpResult): number => result.status).sort(),
      [200, 409, 409, 409],
    );
  });
}).catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
