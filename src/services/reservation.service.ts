import { randomUUID } from 'node:crypto';
import type { ReservationResult } from '../interfaces/reservation-result.interface';
import type { CreateReservationRequest, Reservation } from '../types/reservation';
import { getResource } from './resource.service';

const reservations: Reservation[] = [];

export function createReservation(input: CreateReservationRequest): ReservationResult {
  const resource = getResource(input.resourceId);
  if (!resource) return { kind: 'not_found' };
  if (!resource.isAvailable) return { kind: 'unavailable' };

  const start = Date.parse(input.startTime);
  const end = Date.parse(input.endTime);
  const overlaps = reservations.some(
    (reservation: Reservation): boolean =>
      reservation.resourceId === input.resourceId &&
      reservation.status !== 'CANCELLED' &&
      start < Date.parse(reservation.endTime) &&
      end > Date.parse(reservation.startTime),
  );
  if (overlaps) return { kind: 'conflict' };

  const reservation: Reservation = {
    ...input,
    id: randomUUID(),
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    status: 'CONFIRMED',
  };
  // No await between checking and inserting: one local process cannot interleave bookings here.
  reservations.push(reservation);
  return { kind: 'created', reservation: { ...reservation } };
}

export function listUserReservations(userId: string): Reservation[] {
  const now = Date.now();
  return reservations
    .filter(
      (reservation: Reservation): boolean =>
        reservation.userId === userId &&
        reservation.status !== 'CANCELLED' &&
        Date.parse(reservation.endTime) > now,
    )
    .map((reservation: Reservation): Reservation => ({ ...reservation }));
}
