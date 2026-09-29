import { json, Router } from 'express';
import {
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
