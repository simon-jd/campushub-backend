import type { Reservation } from '../types/reservation';

export interface ReservationCreated {
  kind: 'created';
  reservation: Reservation;
}

export interface ReservationRejected {
  kind: 'not_found' | 'unavailable' | 'conflict';
}

export type ReservationResult = ReservationCreated | ReservationRejected;

export interface ReservationUpdated {
  kind: 'updated';
  reservation: Reservation;
}

// 'invalid_state' means the reservation exists but its current status forbids the transition,
// which the Controller maps to 409 rather than the 404 used for a missing reservation.
export interface ReservationTransitionRejected {
  kind: 'not_found' | 'invalid_state';
}

export type ReservationTransitionResult = ReservationUpdated | ReservationTransitionRejected;
