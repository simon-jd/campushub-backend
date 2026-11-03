import { useEffect, useMemo, useState } from 'react';
import {
  cancelReservation,
  createReservation,
  describeApiError,
  fetchUserReservations,
  isStudentId,
  type CreateReservationDTO,
  type Reservation,
} from '../api/campushubApi';

export interface ReservationsState {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
  book: (payload: CreateReservationDTO) => Promise<void>;
  cancel: (reservationId: string) => Promise<void>;
}

interface ReservationQuery {
  userId: string;
  version: number;
}

interface ReservationResult {
  query: ReservationQuery;
  reservations: Reservation[];
  error: string | null;
}

export function useReservations(userId: string): ReservationsState {
  const [version, setVersion] = useState(0);
  // Each identity change or refresh gets a distinct query, including A -> B -> A.
  const query = useMemo<ReservationQuery>(() => ({ userId, version }), [userId, version]);
  const [result, setResult] = useState<ReservationResult | null>(null);

  useEffect(() => {
    if (!isStudentId(query.userId)) {
      return;
    }
    let active = true;
    fetchUserReservations(query.userId)
      .then((reservations: Reservation[]) => {
        if (active) {
          setResult({ query, reservations, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setResult({
            query,
            reservations: [],
            error: describeApiError(error, 'Your bookings could not be loaded.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [query]);

  async function book(payload: CreateReservationDTO): Promise<void> {
    await createReservation(payload);
    setVersion((current) => current + 1);
  }

  function setCancellationError(error: string | null): void {
    setResult((current) => (current?.query === query ? { ...current, error } : current));
  }

  async function cancel(reservationId: string): Promise<void> {
    setCancellationError(null);
    try {
      await cancelReservation(reservationId);
      setVersion((current) => current + 1);
    } catch (error: unknown) {
      setCancellationError(describeApiError(error, 'The reservation could not be cancelled.'));
      throw error;
    }
  }

  const current = result?.query === query ? result : null;
  return {
    reservations: current?.reservations ?? [],
    isLoading: isStudentId(userId) && current === null,
    error: current?.error ?? null,
    book,
    cancel,
  };
}
