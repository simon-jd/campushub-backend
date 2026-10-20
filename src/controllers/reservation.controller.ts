import type { Request, Response } from 'express';
import {
  createReservation,
  listUserReservations,
  updateReservationStatus,
} from '../services/reservation.service';
import type { ReservationIdParams } from '../interfaces/request-params.interface';
import type { ErrorResponse, Reservation, ReservationTransition } from '../types/reservation';
import {
  isIdentifier,
  isReservationStatus,
  parseReservationInput,
} from '../validation/reservation.validation';

// Why each transition can be refused, phrased for the client that asked for it.
const TRANSITION_CONFLICTS: Record<ReservationTransition, string> = {
  CONFIRMED: 'Only a PENDING reservation can be confirmed.',
  CANCELLED: 'Only a PENDING or CONFIRMED reservation can be cancelled.',
};

// Express 5 forwards rejected handler Promises to the shared error middleware (500 INTERNAL_ERROR).
export async function createReservationController(
  request: Request<Record<string, string>, Reservation | ErrorResponse, unknown>,
  response: Response<Reservation | ErrorResponse>,
): Promise<void> {
  if (!request.is('application/json')) {
    response
      .status(415)
      .json({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json.' });
    return;
  }
  const input = parseReservationInput(request.body);
  if (!input || Object.keys(request.query).length > 0) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message:
        'Provide only resourceId, userId, startTime and endTime; IDs and ISO timestamps must be valid and startTime must precede endTime.',
    });
    return;
  }
  const result = await createReservation(input);
  switch (result.kind) {
    case 'not_found':
      response
        .status(404)
        .json({ code: 'RESOURCE_NOT_FOUND', message: 'The resource was not found.' });
      return;
    case 'unavailable':
      response
        .status(409)
        .json({ code: 'RESOURCE_UNAVAILABLE', message: 'The resource is unavailable.' });
      return;
    case 'conflict':
      response.status(409).json({
        code: 'DOUBLE_BOOKING',
        message: 'Resource is already reserved for this time slot.',
      });
      return;
    case 'created':
      response.status(201).json(result.reservation);
  }
}

export async function listUserReservationsController(
  request: Request<Record<string, string>, Reservation[] | ErrorResponse, unknown>,
  response: Response<Reservation[] | ErrorResponse>,
): Promise<void> {
  const userId = request.params.userId;
  const status = request.query.status;
  if (
    !isIdentifier(userId) ||
    Object.keys(request.query).some((key: string): boolean => key !== 'status') ||
    (status !== undefined && !isReservationStatus(status))
  ) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message:
        'A valid userId is required; status, when present, must be exactly one of PENDING, CONFIRMED or CANCELLED.',
    });
    return;
  }
  response.status(200).json(await listUserReservations(userId, status));
}

export async function cancelReservationController(
  request: Request<ReservationIdParams, Reservation | ErrorResponse, unknown>,
  response: Response<Reservation | ErrorResponse>,
): Promise<void> {
  await transitionReservation(request, response, 'CANCELLED');
}

export async function confirmReservationController(
  request: Request<ReservationIdParams, Reservation | ErrorResponse, unknown>,
  response: Response<Reservation | ErrorResponse>,
): Promise<void> {
  await transitionReservation(request, response, 'CONFIRMED');
}

// Both transition routes differ only in their target status and refusal message. An id that is
// not an existing reservation's ObjectId returns 404, matching how creation treats resourceId.
async function transitionReservation(
  request: Request<ReservationIdParams, Reservation | ErrorResponse, unknown>,
  response: Response<Reservation | ErrorResponse>,
  target: ReservationTransition,
): Promise<void> {
  if (Object.keys(request.query).length > 0) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Query parameters are not supported on this route.',
    });
    return;
  }
  const result = await updateReservationStatus(request.params.id, target);
  switch (result.kind) {
    case 'not_found':
      response
        .status(404)
        .json({ code: 'RESERVATION_NOT_FOUND', message: 'The reservation was not found.' });
      return;
    case 'invalid_state':
      response
        .status(409)
        .json({ code: 'INVALID_STATE_TRANSITION', message: TRANSITION_CONFLICTS[target] });
      return;
    case 'updated':
      response.status(200).json(result.reservation);
  }
}
