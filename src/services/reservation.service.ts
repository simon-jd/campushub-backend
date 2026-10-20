import { isObjectIdOrHexString, Types } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import type {
  ReservationResult,
  ReservationTransitionResult,
} from '../interfaces/reservation-result.interface';
import { ReservationModel } from '../models/Reservation.model';
import type { ReservationDocument, ReservationRecord } from '../models/Reservation.model';
import type {
  CreateReservationRequest,
  Reservation,
  ReservationStatus,
  ReservationTransition,
} from '../types/reservation';
import { getResource } from './resource.service';

// Which current statuses permit each transition. CANCELLED appears in no list, so it is
// terminal, and a status is never a legal source for itself: re-confirming or re-cancelling
// is reported as a conflict instead of silently succeeding.
const ALLOWED_SOURCES: Record<ReservationTransition, readonly ReservationStatus[]> = {
  CONFIRMED: ['PENDING'],
  CANCELLED: ['PENDING', 'CONFIRMED'],
};

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

// Every reservation the user owns, including CANCELLED and past ones, so a cancellation stays
// visible to the student who made it. Callers narrow the list with an explicit status.
export async function listUserReservations(
  userId: string,
  status?: ReservationStatus,
): Promise<Reservation[]> {
  const query: QueryFilter<ReservationRecord> = { userId };
  if (status !== undefined) query.status = status;
  const documents = await ReservationModel.find(query).sort({ _id: 1 }).exec();
  return documents.map(toReservation);
}

// One conditional update performs the whole transition, so two concurrent cancellations cannot
// both observe the same source status and both report success. A cancellation needs no booking
// lock: it only removes an interval from the overlap query, so a create racing it either still
// sees the old reservation and declines, or no longer sees it and succeeds. Neither double-books.
export async function updateReservationStatus(
  id: string,
  target: ReservationTransition,
): Promise<ReservationTransitionResult> {
  if (!isObjectIdOrHexString(id)) return { kind: 'not_found' };
  const document = await ReservationModel.findOneAndUpdate(
    { _id: id, status: { $in: ALLOWED_SOURCES[target] } },
    { status: target },
    { returnDocument: 'after' },
  ).exec();
  if (document !== null) return { kind: 'updated', reservation: toReservation(document) };
  // The update matched nothing. Re-read to separate a missing reservation from a status that
  // forbids this transition, because the two map to different HTTP responses.
  const existing = await ReservationModel.exists({ _id: id }).exec();
  return { kind: existing === null ? 'not_found' : 'invalid_state' };
}

// Upserting by id keeps sample bookings stable across reseeds, mirroring seedResources.
// Saving documents rather than issuing an update keeps the schema's startTime/endTime check
// active; Mongoose update validators cannot see sibling paths they are not writing.
export async function seedReservations(
  reservations: readonly Reservation[],
): Promise<Reservation[]> {
  const seeded: Reservation[] = [];
  for (const reservation of reservations) {
    const document =
      (await ReservationModel.findById(reservation.id).exec()) ??
      new ReservationModel({ _id: reservation.id });
    document.set({
      resourceId: new Types.ObjectId(reservation.resourceId),
      userId: reservation.userId,
      startTime: new Date(reservation.startTime),
      endTime: new Date(reservation.endTime),
      status: reservation.status,
    });
    await document.save();
    seeded.push(toReservation(document));
  }
  return seeded;
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
