import { useState, type ReactElement } from 'react';
import type { Reservation, Resource } from '../api/campushubApi';

export interface UserReservationsProps {
  reservations: Reservation[];
  resourcesById: ReadonlyMap<string, Resource>;
  isLoading: boolean;
  error: string | null;
  onCancel: (reservationId: string) => Promise<void>;
}

function formatWindow(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startTime} – ${endTime}`;
  }
  return `${start.toLocaleString()} – ${end.toLocaleString()}`;
}

export function UserReservations({
  reservations,
  resourcesById,
  isLoading,
  error,
  onCancel,
}: UserReservationsProps): ReactElement {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const active = reservations.filter((reservation) => reservation.status !== 'CANCELLED');

  async function handleCancel(reservationId: string): Promise<void> {
    setCancellingId(reservationId);
    try {
      await onCancel(reservationId);
    } catch {
      // The parent records the error banner for this failure.
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase">Dashboard</p>
      <h2 className="mt-1 text-2xl text-stone-900">My Bookings</h2>

      {isLoading ? <p className="mt-4 text-sm text-stone-600">Loading reservations...</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {!isLoading && error === null && active.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No active reservations.</p>
      ) : null}

      <ul className="mt-4 grid gap-3">
        {active.map((reservation) => {
          const resource = resourcesById.get(reservation.resourceId);
          const cancelling = cancellingId === reservation.id;
          return (
            <li key={reservation.id} className="rounded-xl border border-stone-200 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-stone-900">
                  {resource?.name ?? reservation.resourceId}
                </p>
                <p className="text-xs font-semibold tracking-wide text-stone-600">
                  {reservation.status}
                </p>
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {formatWindow(reservation.startTime, reservation.endTime)}
              </p>
              <button
                type="button"
                aria-label="Cancel reservation"
                disabled={cancelling}
                onClick={() => {
                  void handleCancel(reservation.id);
                }}
                className="mt-3 rounded-full border border-stone-400 px-3 py-1 text-sm font-semibold text-stone-800 disabled:opacity-60"
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
