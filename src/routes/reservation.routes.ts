import { json, Router } from 'express';
import {
  cancelReservationController,
  confirmReservationController,
  createReservationController,
  listUserReservationsController,
} from '../controllers/reservation.controller';

export const reservationRouter = Router();
reservationRouter.post(
  '/reservations',
  json({ limit: '16kb', inflate: false }),
  createReservationController,
);
reservationRouter.get('/reservations/user/:userId', listUserReservationsController);
// Status transitions carry no request body, so no JSON parser is mounted on these routes.
reservationRouter.patch('/reservations/:id/cancel', cancelReservationController);
reservationRouter.patch('/reservations/:id/confirm', confirmReservationController);
