import type { Request, Response } from 'express';
import { createReservation, listUserReservations } from '../services/reservation.service';
import type { ErrorResponse, Reservation } from '../types/reservation';
import { isIdentifier, parseReservationInput } from '../validation/reservation.validation';

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
  if (!isIdentifier(userId) || Object.keys(request.query).length > 0) {
    response.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'A valid userId is required; query parameters are not supported.',
    });
    return;
  }
  response.status(200).json(await listUserReservations(userId));
}
