import { Error as MongooseError } from 'mongoose';
import { absentId, at, createResource, HOUR, MINUTE, seedReservation } from '../../test/factories';
import type { ReservationResult } from '../../interfaces/reservation-result.interface';
import {
  createReservation,
  listUserReservations,
  seedReservations,
  updateReservationStatus,
} from '../reservation.service';

// Services receive already-typed input, so these tests deliberately bypass the controller's
// validation to prove the service and schema defend themselves against bad data.
async function book(
  resourceId: string,
  startOffset: number,
  endOffset: number,
  userId = 'alice',
): Promise<ReservationResult> {
  return createReservation({
    resourceId,
    userId,
    startTime: at(startOffset),
    endTime: at(endOffset),
  });
}

describe('createReservation — happy path', () => {
  it('places a CONFIRMED reservation and echoes the stored fields', async () => {
    const resource = await createResource();
    const result = await book(resource.id, 0, HOUR);

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.reservation).toEqual({
      id: result.reservation.id,
      resourceId: resource.id,
      userId: 'alice',
      startTime: at(0),
      endTime: at(HOUR),
      status: 'CONFIRMED',
    });
    expect(result.reservation.id).toMatch(/^[0-9a-f]{24}$/);
  });

  it('allows the same slot on a different resource', async () => {
    const first = await createResource({ name: 'Room A' });
    const second = await createResource({ name: 'Room B' });

    expect((await book(first.id, 0, HOUR)).kind).toBe('created');
    expect((await book(second.id, 0, HOUR)).kind).toBe('created');
  });

  it('allows the same user to hold several non-overlapping slots', async () => {
    const resource = await createResource();

    expect((await book(resource.id, 0, HOUR)).kind).toBe('created');
    expect((await book(resource.id, 2 * HOUR, 3 * HOUR)).kind).toBe('created');
  });

  it('treats a resource id in upper-case hex as the same resource', async () => {
    const resource = await createResource();
    expect((await book(resource.id, 0, HOUR)).kind).toBe('created');
    expect((await book(resource.id.toUpperCase(), 0, HOUR)).kind).toBe('conflict');
  });
});

describe('createReservation — double booking and overlap boundaries', () => {
  it('rejects an exact start/end match as a conflict', async () => {
    const resource = await createResource();
    await book(resource.id, 0, HOUR);

    expect((await book(resource.id, 0, HOUR, 'bob')).kind).toBe('conflict');
  });

  it('rejects an overlap of exactly 1 ms at the start of an existing booking', async () => {
    const resource = await createResource();
    await book(resource.id, HOUR, 2 * HOUR);

    // New booking ends 1 ms after the existing one starts.
    expect((await book(resource.id, 0, HOUR + 1, 'bob')).kind).toBe('conflict');
  });

  it('rejects an overlap of exactly 1 ms at the end of an existing booking', async () => {
    const resource = await createResource();
    await book(resource.id, HOUR, 2 * HOUR);

    // New booking starts 1 ms before the existing one ends.
    expect((await book(resource.id, 2 * HOUR - 1, 3 * HOUR, 'bob')).kind).toBe('conflict');
  });

  it('accepts back-to-back bookings because intervals are half-open [start, end)', async () => {
    const resource = await createResource();
    await book(resource.id, HOUR, 2 * HOUR);

    expect((await book(resource.id, 0, HOUR, 'bob')).kind).toBe('created');
    expect((await book(resource.id, 2 * HOUR, 3 * HOUR, 'carol')).kind).toBe('created');
  });

  it('accepts a booking that leaves a 1 ms gap on either side', async () => {
    const resource = await createResource();
    await book(resource.id, HOUR, 2 * HOUR);

    expect((await book(resource.id, 0, HOUR - 1, 'bob')).kind).toBe('created');
    expect((await book(resource.id, 2 * HOUR + 1, 3 * HOUR, 'carol')).kind).toBe('created');
  });

  it('rejects a booking fully inside an existing one', async () => {
    const resource = await createResource();
    await book(resource.id, 0, 4 * HOUR);

    expect((await book(resource.id, HOUR, 2 * HOUR, 'bob')).kind).toBe('conflict');
  });

  it('rejects a booking that fully contains an existing one', async () => {
    const resource = await createResource();
    await book(resource.id, HOUR, 2 * HOUR);

    expect((await book(resource.id, 0, 4 * HOUR, 'bob')).kind).toBe('conflict');
  });

  it('rejects the smallest possible booking (1 ms) inside an existing one', async () => {
    const resource = await createResource();
    await book(resource.id, 0, HOUR);

    expect((await book(resource.id, 30 * MINUTE, 30 * MINUTE + 1, 'bob')).kind).toBe('conflict');
  });

  it('compares instants, not strings, when offsets differ', async () => {
    const resource = await createResource();
    // 10:00+02:00 is 08:00Z.
    await createReservation({
      resourceId: resource.id,
      userId: 'alice',
      startTime: '2099-06-01T10:00:00+02:00',
      endTime: '2099-06-01T11:00:00+02:00',
    });

    // 08:30Z–09:30Z overlaps 08:00Z–09:00Z.
    const result = await createReservation({
      resourceId: resource.id,
      userId: 'bob',
      startTime: '2099-06-01T08:30:00Z',
      endTime: '2099-06-01T09:30:00Z',
    });
    expect(result.kind).toBe('conflict');
  });

  it('lets a CANCELLED reservation release its slot', async () => {
    const resource = await createResource();
    const first = await book(resource.id, 0, HOUR);
    if (first.kind !== 'created') throw new Error('setup failed');
    await updateReservationStatus(first.reservation.id, 'CANCELLED');

    expect((await book(resource.id, 0, HOUR, 'bob')).kind).toBe('created');
  });

  it('keeps a PENDING reservation blocking its slot', async () => {
    const resource = await createResource();
    await seedReservation(resource.id, {
      startTime: at(0),
      endTime: at(HOUR),
      status: 'PENDING',
    });

    expect((await book(resource.id, 0, HOUR, 'bob')).kind).toBe('conflict');
  });
});

describe('createReservation — invalid time ranges (schema guard)', () => {
  it('rejects endTime before startTime with a ValidationError and stores nothing', async () => {
    const resource = await createResource();

    await expect(book(resource.id, HOUR, 0)).rejects.toBeInstanceOf(MongooseError.ValidationError);
    expect(await listUserReservations('alice')).toEqual([]);
  });

  it('rejects endTime equal to startTime (zero-length range)', async () => {
    const resource = await createResource();

    await expect(book(resource.id, HOUR, HOUR)).rejects.toBeInstanceOf(
      MongooseError.ValidationError,
    );
  });

  it('rejects endTime one millisecond before startTime', async () => {
    const resource = await createResource();

    await expect(book(resource.id, HOUR, HOUR - 1)).rejects.toBeInstanceOf(
      MongooseError.ValidationError,
    );
  });

  it('rejects unparseable timestamps instead of storing Invalid Date', async () => {
    const resource = await createResource();

    await expect(
      createReservation({
        resourceId: resource.id,
        userId: 'alice',
        startTime: 'not-a-date',
        endTime: at(HOUR),
      }),
    ).rejects.toThrow();
    expect(await listUserReservations('alice')).toEqual([]);
  });

  it('rejects a userId the schema forbids', async () => {
    const resource = await createResource();

    await expect(book(resource.id, 0, HOUR, 'has space')).rejects.toBeInstanceOf(
      MongooseError.ValidationError,
    );
  });

  it('releases the per-resource lock after a failed booking', async () => {
    const resource = await createResource();
    await expect(book(resource.id, HOUR, 0)).rejects.toThrow();

    expect((await book(resource.id, 0, HOUR)).kind).toBe('created');
  });
});

describe('createReservation — resource lookups', () => {
  it('reports not_found for a well-formed ObjectId that does not exist', async () => {
    expect(await book(absentId(), 0, HOUR)).toEqual({ kind: 'not_found' });
  });

  it('reports not_found for an identifier that is not an ObjectId', async () => {
    expect(await book('room-302', 0, HOUR)).toEqual({ kind: 'not_found' });
  });

  it('reports not_found for the all-zero ObjectId', async () => {
    expect(await book('0'.repeat(24), 0, HOUR)).toEqual({ kind: 'not_found' });
  });

  it('reports unavailable for a resource marked unavailable, even in an empty schedule', async () => {
    const resource = await createResource({ isAvailable: false });

    expect(await book(resource.id, 0, HOUR)).toEqual({ kind: 'unavailable' });
  });
});

describe('createReservation — concurrency', () => {
  it('lets exactly one of many simultaneous identical requests win', async () => {
    const resource = await createResource();
    const attempts = Array.from({ length: 25 }, (_, index) =>
      book(resource.id, 0, HOUR, `user-${String(index)}`),
    );

    const results = await Promise.all(attempts);

    expect(results.filter((result) => result.kind === 'created')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'conflict')).toHaveLength(24);
  });

  it('never double-books overlapping slots racing across a boundary', async () => {
    const resource = await createResource();
    // Slots start every 30 minutes but last an hour, so each overlaps its neighbours.
    const attempts = Array.from({ length: 10 }, (_, index) =>
      book(resource.id, index * 30 * MINUTE, index * 30 * MINUTE + HOUR, `user-${String(index)}`),
    );

    const results = await Promise.all(attempts);
    const created = results.flatMap((result) =>
      result.kind === 'created' ? [result.reservation] : [],
    );

    for (const [i, a] of created.entries()) {
      for (const b of created.slice(i + 1)) {
        const overlap = a.startTime < b.endTime && b.startTime < a.endTime;
        expect(overlap).toBe(false);
      }
    }
    expect(created.length).toBeGreaterThan(1);
  });

  it('accepts simultaneous bookings for different resources', async () => {
    const [first, second] = await Promise.all([createResource(), createResource()]);

    const results = await Promise.all([book(first.id, 0, HOUR), book(second.id, 0, HOUR)]);

    expect(results.map((result) => result.kind)).toEqual(['created', 'created']);
  });
});

describe('listUserReservations', () => {
  it('returns every status for the user, in creation order', async () => {
    const resource = await createResource();
    const first = await book(resource.id, 0, HOUR);
    const second = await book(resource.id, 2 * HOUR, 3 * HOUR);
    if (first.kind !== 'created' || second.kind !== 'created') throw new Error('setup failed');
    await updateReservationStatus(first.reservation.id, 'CANCELLED');

    const all = await listUserReservations('alice');

    expect(all.map((reservation) => reservation.id)).toEqual([
      first.reservation.id,
      second.reservation.id,
    ]);
    expect(all.map((reservation) => reservation.status)).toEqual(['CANCELLED', 'CONFIRMED']);
  });

  it('narrows by status only when one is given', async () => {
    const resource = await createResource();
    await book(resource.id, 0, HOUR);
    await seedReservation(resource.id, {
      userId: 'alice',
      startTime: at(5 * HOUR),
      endTime: at(6 * HOUR),
      status: 'PENDING',
    });

    expect(await listUserReservations('alice', 'PENDING')).toHaveLength(1);
    expect(await listUserReservations('alice', 'CONFIRMED')).toHaveLength(1);
    expect(await listUserReservations('alice', 'CANCELLED')).toEqual([]);
    expect(await listUserReservations('alice')).toHaveLength(2);
  });

  it('never leaks another user’s reservations', async () => {
    const resource = await createResource();
    await book(resource.id, 0, HOUR, 'alice');
    await book(resource.id, 2 * HOUR, 3 * HOUR, 'bob');

    const mine = await listUserReservations('alice');

    expect(mine).toHaveLength(1);
    expect(mine[0]?.userId).toBe('alice');
  });

  it('returns an empty list for an unknown user', async () => {
    expect(await listUserReservations('nobody')).toEqual([]);
  });

  it('treats a NoSQL-operator-looking userId as a literal string', async () => {
    const resource = await createResource();
    await book(resource.id, 0, HOUR, 'alice');

    expect(await listUserReservations('{"$ne":null}')).toEqual([]);
  });
});

describe('updateReservationStatus', () => {
  it('cancels a CONFIRMED reservation', async () => {
    const resource = await createResource();
    const created = await book(resource.id, 0, HOUR);
    if (created.kind !== 'created') throw new Error('setup failed');

    const result = await updateReservationStatus(created.reservation.id, 'CANCELLED');

    expect(result).toEqual({
      kind: 'updated',
      reservation: { ...created.reservation, status: 'CANCELLED' },
    });
  });

  it('cancels a PENDING reservation', async () => {
    const resource = await createResource();
    const pending = await seedReservation(resource.id);

    const result = await updateReservationStatus(pending.id, 'CANCELLED');

    expect(result.kind).toBe('updated');
  });

  it('confirms a PENDING reservation', async () => {
    const resource = await createResource();
    const pending = await seedReservation(resource.id);

    const result = await updateReservationStatus(pending.id, 'CONFIRMED');

    expect(result).toEqual({
      kind: 'updated',
      reservation: { ...pending, status: 'CONFIRMED' },
    });
  });

  it('reports invalid_state when cancelling twice', async () => {
    const resource = await createResource();
    const created = await book(resource.id, 0, HOUR);
    if (created.kind !== 'created') throw new Error('setup failed');
    await updateReservationStatus(created.reservation.id, 'CANCELLED');

    expect(await updateReservationStatus(created.reservation.id, 'CANCELLED')).toEqual({
      kind: 'invalid_state',
    });
  });

  it('treats CANCELLED as terminal: it cannot be confirmed again', async () => {
    const resource = await createResource();
    const pending = await seedReservation(resource.id);
    await updateReservationStatus(pending.id, 'CANCELLED');

    expect(await updateReservationStatus(pending.id, 'CONFIRMED')).toEqual({
      kind: 'invalid_state',
    });
  });

  it('refuses to re-confirm an already CONFIRMED reservation', async () => {
    const resource = await createResource();
    const created = await book(resource.id, 0, HOUR);
    if (created.kind !== 'created') throw new Error('setup failed');

    expect(await updateReservationStatus(created.reservation.id, 'CONFIRMED')).toEqual({
      kind: 'invalid_state',
    });
  });

  it('reports not_found for an absent reservation id', async () => {
    expect(await updateReservationStatus(absentId(), 'CANCELLED')).toEqual({ kind: 'not_found' });
  });

  it.each(['', 'abc', '12345', 'g'.repeat(24), '../etc/passwd', '{"$ne":null}'])(
    'reports not_found for malformed id %j without querying',
    async (id) => {
      expect(await updateReservationStatus(id, 'CANCELLED')).toEqual({ kind: 'not_found' });
    },
  );

  it('lets only one of many concurrent cancellations succeed', async () => {
    const resource = await createResource();
    const created = await book(resource.id, 0, HOUR);
    if (created.kind !== 'created') throw new Error('setup failed');

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        updateReservationStatus(created.reservation.id, 'CANCELLED'),
      ),
    );

    expect(results.filter((result) => result.kind === 'updated')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'invalid_state')).toHaveLength(9);
  });
});

describe('seedReservations', () => {
  it('is idempotent: reseeding the same id updates in place', async () => {
    const resource = await createResource();
    const original = await seedReservation(resource.id, { status: 'PENDING' });

    const [updated] = await seedReservations([{ ...original, status: 'CONFIRMED' }]);

    expect(updated?.id).toBe(original.id);
    expect(updated?.status).toBe('CONFIRMED');
    expect(await listUserReservations('seed-user')).toHaveLength(1);
  });

  it('rejects a seeded reservation whose endTime precedes its startTime', async () => {
    const resource = await createResource();

    await expect(
      seedReservation(resource.id, { startTime: at(HOUR), endTime: at(0) }),
    ).rejects.toBeInstanceOf(MongooseError.ValidationError);
  });
});
