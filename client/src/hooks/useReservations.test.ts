import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReservations } from './useReservations';
import type { Reservation } from '../api/campushubApi';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../api/campushubApi', async () => {
  const actual = await vi.importActual<typeof import('../api/campushubApi')>('../api/campushubApi');
  return { ...actual, fetchUserReservations: api.fetch };
});

const reservation: Reservation = {
  id: 'booking-1',
  resourceId: 'room-1',
  userId: 'student-1',
  startTime: '2026-11-03T10:00:00.000Z',
  endTime: '2026-11-03T11:00:00.000Z',
  status: 'CONFIRMED',
};

describe('useReservations', () => {
  beforeEach(() => {
    api.fetch.mockReset();
  });

  it('resets loading and errors when the student changes', async () => {
    api.fetch.mockRejectedValueOnce(new Error('offline'));
    let finish: (value: Reservation[]) => void = () => {};
    api.fetch.mockImplementationOnce(
      () =>
        new Promise<Reservation[]>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook((userId: string) => useReservations(userId), {
      initialProps: 'student-1',
    });
    await waitFor(() => {
      expect(result.current.error).toBe('Your bookings could not be loaded.');
    });
    rerender('student-2');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    await act(async () => {
      finish([]);
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('starts a fresh loading state when returning to a previously loaded student', async () => {
    api.fetch.mockRejectedValueOnce(new Error('offline'));
    api.fetch.mockImplementation(() => new Promise<Reservation[]>(() => {}));
    const { result, rerender } = renderHook((userId: string) => useReservations(userId), {
      initialProps: 'student-1',
    });
    await waitFor(() => {
      expect(result.current.error).toBe('Your bookings could not be loaded.');
    });
    rerender('student-2');
    rerender('student-1');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not show another student bookings when the new fetch fails', async () => {
    api.fetch.mockResolvedValueOnce([reservation]);
    api.fetch.mockRejectedValueOnce(new Error('offline'));
    const { result, rerender } = renderHook((userId: string) => useReservations(userId), {
      initialProps: 'student-1',
    });
    await waitFor(() => {
      expect(result.current.reservations).toEqual([reservation]);
    });
    rerender('student-2');
    await waitFor(() => {
      expect(result.current.error).toBe('Your bookings could not be loaded.');
    });
    expect(result.current.reservations).toEqual([]);
  });

  it('ignores stale results and does not fetch an invalid student ID', async () => {
    let finish: (value: Reservation[]) => void = () => {};
    api.fetch.mockImplementationOnce(
      () =>
        new Promise<Reservation[]>((resolve) => {
          finish = resolve;
        }),
    );
    api.fetch.mockResolvedValueOnce([]);
    const { result, rerender } = renderHook((userId: string) => useReservations(userId), {
      initialProps: 'student-1',
    });
    rerender('student-2');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    await act(async () => {
      finish([reservation]);
    });
    expect(result.current.reservations).toEqual([]);
    rerender('invalid id');
    expect(api.fetch).toHaveBeenCalledTimes(2);
  });
});
