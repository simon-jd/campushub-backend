import type { Reservation } from '../types/reservation';

export interface ReservationCreated {
  kind: 'created';
  reservation: Reservation;
}

export interface ReservationRejected {
  kind: 'not_found' | 'unavailable' | 'conflict';
}

export type ReservationResult = ReservationCreated | ReservationRejected;
