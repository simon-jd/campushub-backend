import { useState } from 'react';
import {
  ApiError,
  describeApiError,
  isStudentId,
  type CreateReservationDTO,
  type Resource,
} from '../api/campushubApi';

export interface BookingFormState {
  start: string;
  end: string;
  setStart: (value: string) => void;
  setEnd: (value: string) => void;
  error: string | null;
  notice: string | null;
  isSubmitting: boolean;
  submit: () => Promise<void>;
}

function bookingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409 && error.code === 'DOUBLE_BOOKING') {
    return 'This resource is already reserved for the selected time window.';
  }
  return describeApiError(error, 'The booking could not be completed.');
}

export function useBookingForm(
  resource: Resource | null,
  userId: string,
  onSubmit: (payload: CreateReservationDTO) => Promise<void>,
): BookingFormState {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(): Promise<void> {
    setNotice(null);

    if (!resource) {
      setError('Select a resource before booking.');
      return;
    }
    if (start === '' || end === '') {
      setError('Choose a start and end time.');
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Choose a start and end time.');
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setError('End time must be after the start time.');
      return;
    }
    if (!isStudentId(userId)) {
      setError('Enter a student ID using letters, numbers, hyphens, or underscores.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        resourceId: resource.id,
        userId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });
      setNotice('Reservation confirmed.');
    } catch (caught: unknown) {
      setError(bookingErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return { start, end, setStart, setEnd, error, notice, isSubmitting, submit };
}
