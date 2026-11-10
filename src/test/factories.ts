import { Types } from 'mongoose';
import { seedReservations } from '../services/reservation.service';
import { seedResources } from '../services/resource.service';
import type { Reservation, Resource } from '../types/reservation';
import { isRecord } from '../validation/reservation.validation';

// Test data goes through the Services' own seed functions, so suites outside src/services never
// import Models (the lint boundaries forbid it) and still exercise the real persistence path.
export async function createResource(
  overrides: Partial<Omit<Resource, 'id'>> = {},
): Promise<Resource> {
  const [resource] = await seedResources([
    {
      id: new Types.ObjectId().toHexString(),
      name: 'Study Room 302',
      type: 'ROOM',
      location: 'Library',
      isAvailable: true,
      ...overrides,
    },
  ]);
  if (resource === undefined) throw new Error('seedResources returned nothing');
  return resource;
}

// Seeding bypasses the controller, so it is the only way to get a PENDING reservation.
export async function seedReservation(
  resourceId: string,
  overrides: Partial<Omit<Reservation, 'id' | 'resourceId'>> = {},
): Promise<Reservation> {
  const [reservation] = await seedReservations([
    {
      id: new Types.ObjectId().toHexString(),
      resourceId,
      userId: 'seed-user',
      startTime: '2099-01-01T09:00:00.000Z',
      endTime: '2099-01-01T10:00:00.000Z',
      status: 'PENDING',
      ...overrides,
    },
  ]);
  if (reservation === undefined) throw new Error('seedReservations returned nothing');
  return reservation;
}

// A valid ObjectId that no document uses, for "does not exist" lookups.
export function absentId(): string {
  return new Types.ObjectId().toHexString();
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

// Builds an ISO instant `offsetMs` after a fixed base, so tests can state overlaps to the millisecond.
const BASE_TIME = Date.parse('2099-06-01T09:00:00.000Z');
export function at(offsetMs: number): string {
  return new Date(BASE_TIME + offsetMs).toISOString();
}

// supertest types response bodies as `any`; narrowing through `unknown` keeps assertions type-safe.
export function bodyRecord(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new Error('Expected a JSON object response body');
  return body;
}

export function bodyId(body: unknown): string {
  const { id } = bodyRecord(body);
  if (typeof id !== 'string') throw new Error('Expected a string id');
  return id;
}
