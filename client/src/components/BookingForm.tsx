import type { ReactElement } from 'react';
import type { CreateReservationDTO, Resource } from '../api/campushubApi';
import { useBookingForm } from '../hooks/useBookingForm';

export interface BookingFormProps {
  resource: Resource | null;
  userId: string;
  onSubmit: (payload: CreateReservationDTO) => Promise<void>;
}

export function BookingForm({ resource, userId, onSubmit }: BookingFormProps): ReactElement {
  const { start, end, setStart, setEnd, error, notice, isSubmitting, submit } = useBookingForm(
    resource,
    userId,
    onSubmit,
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase">Booking</p>
      <h2 className="mt-1 text-2xl text-stone-900">Reserve a time</h2>
      <p className="mt-2 text-sm text-stone-600">
        {resource
          ? `Selected: ${resource.name}`
          : 'Select a resource from the directory to start a booking.'}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-stone-800">
          Start
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
            }}
            className="rounded-lg border border-stone-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-stone-800">
          End
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
            }}
            className="rounded-lg border border-stone-300 px-3 py-2 font-normal"
          />
        </label>
      </div>

      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 disabled:opacity-60"
      >
        {isSubmitting ? 'Booking...' : 'Book resource'}
      </button>
    </form>
  );
}
