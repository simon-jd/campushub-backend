import request from 'supertest';
import { app } from '../../app';
import type { CreateReservationRequest } from '../../types/reservation';
import {
  absentId,
  at,
  bodyId,
  bodyRecord,
  createResource,
  HOUR,
  seedReservation,
} from '../../test/factories';

// End-to-end HTTP tests: real Express app, real Mongoose, in-memory MongoDB. The only thing
// faked is the network socket (supertest binds the app to an ephemeral port).
const RESERVATIONS = '/api/v1/reservations';

interface BookingOptions {
  resourceId: string;
  userId?: string;
  start?: number;
  end?: number;
}

function bookingPayload({
  resourceId,
  userId = 'alice',
  start = 0,
  end = HOUR,
}: BookingOptions): CreateReservationRequest {
  return { resourceId, userId, startTime: at(start), endTime: at(end) };
}

async function postBooking(options: BookingOptions): Promise<request.Response> {
  return request(app).post(RESERVATIONS).send(bookingPayload(options));
}

async function postRaw(raw: string, contentType = 'application/json'): Promise<request.Response> {
  return request(app).post(RESERVATIONS).set('Content-Type', contentType).send(raw);
}

describe('POST /api/v1/reservations', () => {
  describe('success', () => {
    it('returns 201 Created with the stored reservation', async () => {
      const resource = await createResource();

      const response = await postBooking({ resourceId: resource.id });

      expect(response.status).toBe(201);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        id: bodyId(response.body),
        resourceId: resource.id,
        userId: 'alice',
        startTime: at(0),
        endTime: at(HOUR),
        status: 'CONFIRMED',
      });
    });

    it('persists the reservation so the user can list it afterwards', async () => {
      const resource = await createResource();
      const created = await postBooking({ resourceId: resource.id });

      const listed = await request(app).get(`${RESERVATIONS}/user/alice`);

      expect(listed.status).toBe(200);
      expect(listed.body).toEqual([created.body]);
    });

    it('normalises an offset timestamp to UTC in the response', async () => {
      const resource = await createResource();

      const response = await request(app).post(RESERVATIONS).send({
        resourceId: resource.id,
        userId: 'alice',
        startTime: '2099-06-01T11:00:00+02:00',
        endTime: '2099-06-01T12:00:00+02:00',
      });

      expect(response.status).toBe(201);
      expect(bodyRecord(response.body).startTime).toBe('2099-06-01T09:00:00.000Z');
    });

    it('accepts a leap-day timestamp that exists (2096-02-29)', async () => {
      const resource = await createResource();

      const response = await request(app).post(RESERVATIONS).send({
        resourceId: resource.id,
        userId: 'alice',
        startTime: '2096-02-29T09:00:00Z',
        endTime: '2096-02-29T10:00:00Z',
      });

      expect(response.status).toBe(201);
    });
  });

  describe('409 Conflict', () => {
    it('returns DOUBLE_BOOKING for an exact start/end match', async () => {
      const resource = await createResource();
      await postBooking({ resourceId: resource.id });

      const response = await postBooking({ resourceId: resource.id, userId: 'bob' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        code: 'DOUBLE_BOOKING',
        message: 'Resource is already reserved for this time slot.',
      });
    });

    it.each([
      ['starts 1 ms before the existing slot ends', HOUR - 1, 2 * HOUR],
      ['ends 1 ms after the existing slot starts', -HOUR, 1],
      ['sits entirely inside the existing slot', 1_000, HOUR - 1_000],
      ['fully contains the existing slot', -HOUR, 2 * HOUR],
    ])('returns 409 when a booking %s', async (_label, start, end) => {
      const resource = await createResource();
      await postBooking({ resourceId: resource.id });

      const response = await postBooking({ resourceId: resource.id, userId: 'bob', start, end });

      expect(response.status).toBe(409);
      expect(bodyRecord(response.body).code).toBe('DOUBLE_BOOKING');
    });

    it('returns 201 for adjacent slots because intervals are half-open', async () => {
      const resource = await createResource();
      await postBooking({ resourceId: resource.id });

      const after = await postBooking({
        resourceId: resource.id,
        userId: 'bob',
        start: HOUR,
        end: 2 * HOUR,
      });
      const before = await postBooking({
        resourceId: resource.id,
        userId: 'carol',
        start: -HOUR,
        end: 0,
      });

      expect(after.status).toBe(201);
      expect(before.status).toBe(201);
    });

    it('returns 409 RESOURCE_UNAVAILABLE for a resource that is switched off', async () => {
      const resource = await createResource({ isAvailable: false });

      const response = await postBooking({ resourceId: resource.id });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        code: 'RESOURCE_UNAVAILABLE',
        message: 'The resource is unavailable.',
      });
    });

    it('frees the slot again after the first reservation is cancelled', async () => {
      const resource = await createResource();
      const first = await postBooking({ resourceId: resource.id });
      await request(app).patch(`${RESERVATIONS}/${bodyId(first.body)}/cancel`);

      const second = await postBooking({ resourceId: resource.id, userId: 'bob' });

      expect(second.status).toBe(201);
    });

    it('lets exactly one of 15 simultaneous identical requests win', async () => {
      const resource = await createResource();

      const responses = await Promise.all(
        Array.from({ length: 15 }, (_, index) =>
          postBooking({ resourceId: resource.id, userId: `user-${String(index)}` }),
        ),
      );

      const statuses = responses.map((response) => response.status);
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 409)).toHaveLength(14);
      const stored = await Promise.all(
        Array.from({ length: 15 }, (_, index) =>
          request(app).get(`${RESERVATIONS}/user/user-${String(index)}`),
        ),
      );
      expect(stored.flatMap((response) => response.body as unknown[])).toHaveLength(1);
    });
  });

  describe('404 Not Found', () => {
    it('returns RESOURCE_NOT_FOUND for a well-formed id that does not exist', async () => {
      const response = await postBooking({ resourceId: absentId() });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The resource was not found.',
      });
    });

    it('returns RESOURCE_NOT_FOUND for an identifier that is not an ObjectId', async () => {
      const response = await postBooking({ resourceId: 'room-302' });

      expect(response.status).toBe(404);
      expect(bodyRecord(response.body).code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('400 Bad Request — payload validation', () => {
    it('rejects endTime before startTime', async () => {
      const resource = await createResource();

      const response = await postBooking({ resourceId: resource.id, start: HOUR, end: 0 });

      expect(response.status).toBe(400);
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('rejects a zero-length reservation (endTime equals startTime)', async () => {
      const resource = await createResource();

      const response = await postBooking({ resourceId: resource.id, start: HOUR, end: HOUR });

      expect(response.status).toBe(400);
    });

    it('rejects endTime one millisecond before startTime', async () => {
      const resource = await createResource();

      const response = await postBooking({ resourceId: resource.id, start: HOUR, end: HOUR - 1 });

      expect(response.status).toBe(400);
    });

    it.each(['resourceId', 'userId', 'startTime', 'endTime'])(
      'rejects a payload missing %s',
      async (field) => {
        const resource = await createResource();
        const payload: Record<string, unknown> = { ...bookingPayload({ resourceId: resource.id }) };
        delete payload[field];

        const response = await request(app).post(RESERVATIONS).send(payload);

        expect(response.status).toBe(400);
        expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
      },
    );

    it('rejects an unexpected extra field', async () => {
      const resource = await createResource();

      const response = await request(app)
        .post(RESERVATIONS)
        .send({ ...bookingPayload({ resourceId: resource.id }), status: 'PENDING' });

      expect(response.status).toBe(400);
    });

    it('rejects query parameters on the create route', async () => {
      const resource = await createResource();

      const response = await request(app)
        .post(`${RESERVATIONS}?force=true`)
        .send(bookingPayload({ resourceId: resource.id }));

      expect(response.status).toBe(400);
    });

    it.each([
      ['an empty string body', ''],
      ['JSON null', 'null'],
      ['a JSON array', '[]'],
      ['a JSON string', '"hello"'],
      ['a JSON number', '42'],
      ['an empty object', '{}'],
    ])('rejects %s', async (_label, raw) => {
      const response = await postRaw(raw);

      expect(response.status).toBe(400);
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    });

    it.each([
      ['2099-02-30T10:00:00Z', 'a day that does not exist'],
      ['2099-02-29T10:00:00Z', 'Feb 29 of a non-leap year'],
      ['2099-13-01T10:00:00Z', 'month 13'],
      ['2099-00-10T10:00:00Z', 'month 0'],
      ['2099-01-01T24:00:00Z', 'hour 24'],
      ['2099-01-01T10:60:00Z', 'minute 60'],
      ['2099-01-01T10:00:00', 'a missing timezone'],
      ['2099-01-01', 'a date without a time'],
      ['2099-01-01 10:00:00Z', 'a space instead of T'],
      ['0000-01-01T00:00:00Z', 'year 0'],
      ['tomorrow at noon', 'free text'],
      ['', 'an empty string'],
    ])('rejects startTime %j (%s)', async (startTime) => {
      const resource = await createResource();

      const response = await request(app)
        .post(RESERVATIONS)
        .send({ ...bookingPayload({ resourceId: resource.id }), startTime });

      expect(response.status).toBe(400);
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('transport-level failures', () => {
    it('returns 415 when the Content-Type is not JSON', async () => {
      const response = await postRaw('hello', 'text/plain');

      expect(response.status).toBe(415);
      expect(bodyRecord(response.body).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('returns 415 when no Content-Type is sent at all', async () => {
      const response = await request(app).post(RESERVATIONS);

      expect(response.status).toBe(415);
    });

    it('returns 400 for malformed JSON', async () => {
      const response = await postRaw('{"resourceId": ');

      expect(response.status).toBe(400);
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    });

    it('returns 413 when the body exceeds the 16 KiB limit', async () => {
      const response = await postRaw(JSON.stringify({ filler: 'x'.repeat(20_000) }));

      expect(response.status).toBe(413);
      expect(bodyRecord(response.body).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('returns 415 for a charset the JSON parser does not support', async () => {
      const response = await postRaw('{}', 'application/json; charset=latin1');

      expect(response.status).toBe(415);
      expect(bodyRecord(response.body).code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('returns 415 for a compressed body because inflation is disabled', async () => {
      const response = await request(app)
        .post(RESERVATIONS)
        .set('Content-Type', 'application/json')
        .set('Content-Encoding', 'gzip')
        .send('{}');

      expect(response.status).toBe(415);
    });
  });
});

describe('GET /api/v1/reservations/user/:userId', () => {
  it('returns 200 and an empty array for a user with no reservations', async () => {
    const response = await request(app).get(`${RESERVATIONS}/user/nobody`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('filters by status', async () => {
    const resource = await createResource();
    await postBooking({ resourceId: resource.id });
    await seedReservation(resource.id, {
      userId: 'alice',
      startTime: at(5 * HOUR),
      endTime: at(6 * HOUR),
      status: 'PENDING',
    });

    const pending = await request(app).get(`${RESERVATIONS}/user/alice?status=PENDING`);
    const confirmed = await request(app).get(`${RESERVATIONS}/user/alice?status=CONFIRMED`);

    expect((pending.body as unknown[]).length).toBe(1);
    expect(bodyRecord((pending.body as unknown[])[0]).status).toBe('PENDING');
    expect((confirmed.body as unknown[]).length).toBe(1);
  });

  it.each(['status=DONE', 'status=confirmed', 'status=', 'status=PENDING&status=CONFIRMED'])(
    'returns 400 for invalid query %s',
    async (query) => {
      const response = await request(app).get(`${RESERVATIONS}/user/alice?${query}`);

      expect(response.status).toBe(400);
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    },
  );

  it('returns 400 for an unsupported query parameter', async () => {
    const response = await request(app).get(`${RESERVATIONS}/user/alice?limit=5`);

    expect(response.status).toBe(400);
  });

  it('returns 400 for a userId that is not a valid identifier', async () => {
    const response = await request(app).get(`${RESERVATIONS}/user/${'a'.repeat(65)}`);

    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/v1/reservations/:id/(confirm|cancel)', () => {
  it('cancels a CONFIRMED reservation with 200', async () => {
    const resource = await createResource();
    const created = await postBooking({ resourceId: resource.id });

    const response = await request(app).patch(`${RESERVATIONS}/${bodyId(created.body)}/cancel`);

    expect(response.status).toBe(200);
    expect(bodyRecord(response.body).status).toBe('CANCELLED');
  });

  it('confirms a PENDING reservation with 200', async () => {
    const resource = await createResource();
    const pending = await seedReservation(resource.id);

    const response = await request(app).patch(`${RESERVATIONS}/${pending.id}/confirm`);

    expect(response.status).toBe(200);
    expect(bodyRecord(response.body).status).toBe('CONFIRMED');
  });

  it('returns 409 INVALID_STATE_TRANSITION when cancelling twice', async () => {
    const resource = await createResource();
    const created = await postBooking({ resourceId: resource.id });
    const url = `${RESERVATIONS}/${bodyId(created.body)}/cancel`;
    await request(app).patch(url);

    const second = await request(app).patch(url);

    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      code: 'INVALID_STATE_TRANSITION',
      message: 'Only a PENDING or CONFIRMED reservation can be cancelled.',
    });
  });

  it('returns 409 when confirming something that is not PENDING', async () => {
    const resource = await createResource();
    const created = await postBooking({ resourceId: resource.id });

    const response = await request(app).patch(`${RESERVATIONS}/${bodyId(created.body)}/confirm`);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: 'INVALID_STATE_TRANSITION',
      message: 'Only a PENDING reservation can be confirmed.',
    });
  });

  it('returns 404 RESERVATION_NOT_FOUND for an absent id', async () => {
    const response = await request(app).patch(`${RESERVATIONS}/${absentId()}/cancel`);

    expect(response.status).toBe(404);
    expect(bodyRecord(response.body).code).toBe('RESERVATION_NOT_FOUND');
  });

  it('returns 404 for a malformed id', async () => {
    const response = await request(app).patch(`${RESERVATIONS}/not-an-id/confirm`);

    expect(response.status).toBe(404);
    expect(bodyRecord(response.body).code).toBe('RESERVATION_NOT_FOUND');
  });

  it('returns 400 when query parameters are supplied', async () => {
    const response = await request(app).patch(`${RESERVATIONS}/${absentId()}/cancel?force=1`);

    expect(response.status).toBe(400);
  });
});

describe('routing fallbacks', () => {
  it('returns the shared 404 body for an unknown path', async () => {
    const response = await request(app).get('/api/v1/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  });

  it('returns 404 for an unsupported method on a known path', async () => {
    const response = await request(app).delete(RESERVATIONS);

    expect(response.status).toBe(404);
  });

  it('returns 400 for a malformed percent-encoded path instead of crashing', async () => {
    const response = await request(app).get(`${RESERVATIONS}/user/%E0%A4%A`);

    expect(response.status).toBe(400);
    expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
  });

  it('serves a healthy response with a UTC timestamp', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(bodyRecord(response.body).status).toBe('ok');
    expect(Number.isNaN(Date.parse(String(bodyRecord(response.body).timestamp)))).toBe(false);
  });
});
