import { Types } from 'mongoose';
import type { ReservationResult } from '../interfaces/reservation-result.interface';
import { ReservationModel } from '../models/Reservation.model';
import type { ReservationDocument } from '../models/Reservation.model';
import type { CreateReservationRequest, Reservation } from '../types/reservation';
import { getResource } from './resource.service';

// The overlap check and insert are separate database round trips. Standalone MongoDB offers no
// multi-document transaction, so bookings for one resource run one at a time in this process.
// This does not protect against several server processes sharing one database.
const bookingQueues = new Map<string, Promise<void>>();

async function withResourceLock<T>(resourceId: string, work: () => Promise<T>): Promise<T> {
  const key = resourceId.toLowerCase();
  const current = (bookingQueues.get(key) ?? Promise.resolve()).then(work);
  // The queue only orders work; the caller still receives the rejection through `current`.
  const settled = current.then(
    (): void => undefined,
    (): void => undefined,
  );
  bookingQueues.set(key, settled);
  try {
    return await current;
  } finally {
    if (bookingQueues.get(key) === settled) bookingQueues.delete(key);
  }
}

export function createReservation(input: CreateReservationRequest): Promise<ReservationResult> {
  return withResourceLock(input.resourceId, async (): Promise<ReservationResult> => {
    const resource = await getResource(input.resourceId);
    if (!resource) return { kind: 'not_found' };
    if (!resource.isAvailable) return { kind: 'unavailable' };

    const resourceId = new Types.ObjectId(resource.id);
    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);
    // Half-open intervals [start, end): adjacent bookings do not overlap.
    const overlapping = await ReservationModel.exists({
      resourceId,
      status: { $ne: 'CANCELLED' },
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    }).exec();
    if (overlapping !== null) return { kind: 'conflict' };

    const document = await ReservationModel.create({
      resourceId,
      userId: input.userId,
      startTime,
      endTime,
      status: 'CONFIRMED',
    });
    return { kind: 'created', reservation: toReservation(document) };
  });
}

export async function listUserReservations(userId: string): Promise<Reservation[]> {
  const documents = await ReservationModel.find({
    userId,
    status: { $ne: 'CANCELLED' },
    endTime: { $gt: new Date() },
  })
    .sort({ _id: 1 })
    .exec();
  return documents.map(toReservation);
}

function toReservation(document: ReservationDocument): Reservation {
  return {
    id: document._id.toHexString(),
    resourceId: document.resourceId.toHexString(),
    userId: document.userId,
    startTime: document.startTime.toISOString(),
    endTime: document.endTime.toISOString(),
    status: document.status,
  };
}
