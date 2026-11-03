import { useState } from 'react';
import { describeApiError } from '../api/campushubApi';

export interface CancellationState {
  cancellingId: string | null;
  error: string | null;
  cancel: (reservationId: string) => Promise<void>;
}

export function useCancellation(
  onCancel: (reservationId: string) => Promise<void>,
): CancellationState {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel(reservationId: string): Promise<void> {
    setCancellingId(reservationId);
    setError(null);
    try {
      await onCancel(reservationId);
    } catch (caught: unknown) {
      setError(describeApiError(caught, 'The reservation could not be cancelled.'));
    } finally {
      setCancellingId(null);
    }
  }

  return { cancellingId, error, cancel };
}
