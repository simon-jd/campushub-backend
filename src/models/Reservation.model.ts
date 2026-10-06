import { model, Schema } from 'mongoose';
import type { HydratedDocument, Types } from 'mongoose';
import type { ReservationStatus } from '../types/reservation';
import { isIdentifier, isRecord } from '../validation/reservation.validation';

// Stored fields only. Times are BSON dates so overlap checks compare instants, not strings.
export interface ReservationRecord {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

export type ReservationDocument = HydratedDocument<ReservationRecord>;

export const reservationSchema = new Schema<ReservationRecord>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
    userId: { type: String, required: true, cast: false, validate: isIdentifier },
    startTime: { type: Date, required: true },
    endTime: {
      type: Date,
      required: true,
      validate: {
        validator: function (this: unknown, value: Date): boolean {
          return (
            isRecord(this) &&
            this.startTime instanceof Date &&
            value.getTime() > this.startTime.getTime()
          );
        },
        message: 'endTime must be later than startTime.',
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

// Supports the per-resource overlap check and the active-reservations-by-user query.
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ userId: 1, endTime: 1 });

export const ReservationModel = model<ReservationRecord>('Reservation', reservationSchema);
