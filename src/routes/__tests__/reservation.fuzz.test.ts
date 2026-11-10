import request from 'supertest';
import { app } from '../../app';
import { at, bodyRecord, createResource, HOUR } from '../../test/factories';

// Boundary fuzzing for POST /api/v1/reservations. Inputs are generated from a seeded PRNG, so a
// failure reproduces exactly: rerun with the same SEED and the same sequence is replayed.
interface Interval {
  start: number;
  end: number;
}

const SEED = 0x5500_0007;
const ITERATIONS = 150;
const URL = '/api/v1/reservations';

function mulberry32(seed: number): () => number {
  let state = seed;
  return (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Values no identifier field may accept: wrong types, empty, oversized, injection-shaped.
const BAD_IDENTIFIERS: readonly unknown[] = [
  null,
  0,
  42,
  true,
  false,
  [],
  ['alice'],
  {},
  { $ne: null },
  { $gt: '' },
  '',
  ' ',
  '-leading-dash',
  'has space',
  'semi;colon',
  '{"$ne":null}',
  '../../etc/passwd',
  '<script>alert(1)</script>',
  "'; DROP TABLE reservations; --",
  'a'.repeat(65),
  'é',
  '用户',
  '\u0000',
  '😀',
];

// Values no timestamp field may accept.
const BAD_TIMESTAMPS: readonly unknown[] = [
  null,
  0,
  1_700_000_000_000,
  -1,
  true,
  [],
  {},
  { $gt: '2000-01-01T00:00:00Z' },
  '',
  ' ',
  'NaN',
  'Invalid Date',
  'tomorrow',
  '2099-02-30T10:00:00Z',
  '2099-02-29T10:00:00Z',
  '2099-04-31T10:00:00Z',
  '2099-13-01T10:00:00Z',
  '2099-00-01T10:00:00Z',
  '2099-01-00T10:00:00Z',
  '2099-01-32T10:00:00Z',
  '2099-01-01T24:00:00Z',
  '2099-01-01T23:60:00Z',
  '2099-01-01T23:59:60Z',
  '2099-01-01T10:00:00',
  '2099-01-01T10:00Z',
  '2099-01-01',
  '2099-01-01 10:00:00Z',
  '2099-01-01t10:00:00z',
  ' 2099-01-01T10:00:00Z',
  '2099-01-01T10:00:00Z ',
  '2099-01-01T10:00:00.1234Z',
  '2099-01-01T10:00:00+24:00',
  '2099-01-01T10:00:00+0100',
  '0000-01-01T00:00:00Z',
  '10000-01-01T00:00:00Z',
  '-2099-01-01T10:00:00Z',
  '２０９９-01-01T10:00:00Z',
  '2099-01-01T10:00:00Z\n',
];

const FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'] as const;
type Field = (typeof FIELDS)[number];

function pick<T>(items: readonly T[], random: () => number): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('empty pool');
  return item;
}

async function reservationCount(userId: string): Promise<number> {
  const response = await request(app).get(`${URL}/user/${userId}`);
  return (response.body as unknown[]).length;
}

describe('POST /api/v1/reservations — seeded fuzzing', () => {
  it(`never answers 5xx and never stores anything for ${String(ITERATIONS)} mutated payloads`, async () => {
    const resource = await createResource();
    const random = mulberry32(SEED);
    const outcomes = new Map<number, number>();

    for (let i = 0; i < ITERATIONS; i += 1) {
      const payload: Record<string, unknown> = {
        resourceId: resource.id,
        userId: 'fuzzer',
        startTime: at(0),
        endTime: at(HOUR),
      };
      const field = pick(FIELDS, random);
      const mutation = Math.floor(random() * 4);
      let description: string;
      if (mutation === 0) {
        delete payload[field];
        description = `remove ${field}`;
      } else if (mutation === 1) {
        payload[`extra${String(i)}`] = 'x';
        description = 'add unknown field';
      } else {
        const bad = pick(
          field === 'userId' || field === 'resourceId' ? BAD_IDENTIFIERS : BAD_TIMESTAMPS,
          random,
        );
        payload[field] = bad;
        description = `${field} = ${JSON.stringify(bad)}`;
      }

      const response = await request(app).post(URL).send(payload);
      outcomes.set(response.status, (outcomes.get(response.status) ?? 0) + 1);

      // resourceId is the one field where an *identifier-shaped* value is also a lookup; every
      // value in the pools above is invalid as an identifier, so all of them are rejected early.
      expect({ status: response.status, mutation: description }).toEqual({
        status: 400,
        mutation: description,
      });
      expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
    }

    expect([...outcomes.keys()]).toEqual([400]);
    expect(await reservationCount('fuzzer')).toBe(0);
  });

  it('rejects every bad value for every field when tried exhaustively', async () => {
    const resource = await createResource();
    const cases: [Field, unknown][] = [
      ...BAD_IDENTIFIERS.map((value): [Field, unknown] => ['userId', value]),
      ...BAD_IDENTIFIERS.map((value): [Field, unknown] => ['resourceId', value]),
      ...BAD_TIMESTAMPS.map((value): [Field, unknown] => ['startTime', value]),
      ...BAD_TIMESTAMPS.map((value): [Field, unknown] => ['endTime', value]),
    ];

    const failures: string[] = [];
    for (const [field, value] of cases) {
      const payload: Record<string, unknown> = {
        resourceId: resource.id,
        userId: 'fuzzer',
        startTime: at(0),
        endTime: at(HOUR),
        [field]: value,
      };
      const response = await request(app).post(URL).send(payload);
      if (response.status !== 400)
        failures.push(`${field}=${JSON.stringify(value)} -> ${String(response.status)}`);
    }

    expect(failures).toEqual([]);
    expect(await reservationCount('fuzzer')).toBe(0);
  });
});

describe('POST /api/v1/reservations — time-range boundary fuzzing', () => {
  it('classifies randomly placed intervals exactly as the half-open overlap rule predicts', async () => {
    const resource = await createResource();
    const random = mulberry32(SEED + 1);
    const accepted: Interval[] = [];

    for (let i = 0; i < 60; i += 1) {
      // Millisecond-resolution offsets within a 10 s window force frequent near-misses.
      const start = Math.floor(random() * 10_000);
      const end = start + 1 + Math.floor(random() * 3_000);
      const expectedConflict = accepted.some((other) => start < other.end && other.start < end);

      const response = await request(app)
        .post(URL)
        .send({
          resourceId: resource.id,
          userId: `user-${String(i)}`,
          startTime: at(start),
          endTime: at(end),
        });

      expect({ start, end, status: response.status }).toEqual({
        start,
        end,
        status: expectedConflict ? 409 : 201,
      });
      if (response.status === 201) accepted.push({ start, end });
    }

    expect(accepted.length).toBeGreaterThan(1);
  });

  it('keeps the invariant "no two live reservations overlap" under a burst of racing requests', async () => {
    const resource = await createResource();
    const random = mulberry32(SEED + 2);
    const attempts = Array.from({ length: 30 }, (_, i) => {
      const start = Math.floor(random() * 5_000);
      const end = start + 1 + Math.floor(random() * 2_000);
      return request(app)
        .post(URL)
        .send({
          resourceId: resource.id,
          userId: `racer-${String(i)}`,
          startTime: at(start),
          endTime: at(end),
        });
    });

    const responses = await Promise.all(attempts);

    const created = responses.filter((response) => response.status === 201);
    expect(responses.every((response) => response.status === 201 || response.status === 409)).toBe(
      true,
    );
    const intervals = created.map((response) => {
      const body = bodyRecord(response.body);
      return { start: Date.parse(String(body.startTime)), end: Date.parse(String(body.endTime)) };
    });
    for (const [i, a] of intervals.entries()) {
      for (const b of intervals.slice(i + 1)) {
        expect(a.start < b.end && b.start < a.end).toBe(false);
      }
    }
    expect(created.length).toBeGreaterThan(0);
  });
});
