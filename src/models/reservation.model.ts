import { model, Schema } from 'mongoose';
import type { Reservation } from '../types/reservation';
import { isIdentifier, isRecord, isTimestamp } from '../validation/reservation.validation';

export const reservationSchema = new Schema<Reservation>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      cast: false,
      match: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    resourceId: { type: String, required: true, cast: false, validate: isIdentifier },
    userId: { type: String, required: true, cast: false, validate: isIdentifier },
    startTime: { type: String, required: true, cast: false, validate: isTimestamp },
    endTime: {
      type: String,
      required: true,
      cast: false,
      validate: {
        validator: function (this: unknown, value: string): boolean {
          return (
            isRecord(this) &&
            isTimestamp(value) &&
            isTimestamp(this.startTime) &&
            Date.parse(value) > Date.parse(this.startTime)
          );
        },
        message: 'endTime must be a valid ISO timestamp later than startTime.',
      },
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
      cast: false,
    },
  },
  { strict: 'throw', id: false, versionKey: false },
);

export const ReservationModel = model<Reservation>('Reservation', reservationSchema);
