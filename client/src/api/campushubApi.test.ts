import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  cancelReservation,
  createReservation,
  fetchResources,
  fetchUserReservations,
} from './campushubApi';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => http,
    isAxiosError: (error: unknown): boolean =>
      typeof error === 'object' && error !== null && 'isAxiosError' in error,
  },
}));

const reservation = {
  id: '000000000000000000000201',
  resourceId: '000000000000000000000101',
  userId: 'user-456',
  startTime: '2026-10-01T10:00:00.000Z',
  endTime: '2026-10-01T11:00:00.000Z',
  status: 'CONFIRMED' as const,
};

describe('campushubApi', () => {
  beforeEach(() => {
    http.get.mockReset();
    http.post.mockReset();
    http.patch.mockReset();
  });

  it('loads the resource catalog and forwards an optional type filter', async () => {
    http.get.mockResolvedValue({ data: [] });

    await fetchResources();
    await fetchResources('LAB');

    expect(http.get).toHaveBeenNthCalledWith(1, '/resources', { params: {} });
    expect(http.get).toHaveBeenNthCalledWith(2, '/resources', { params: { type: 'LAB' } });
  });

  it('creates a reservation with the contract body', async () => {
    http.post.mockResolvedValue({ data: reservation });
    const payload = {
      resourceId: reservation.resourceId,
      userId: reservation.userId,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
    };

    await expect(createReservation(payload)).resolves.toEqual(reservation);
    expect(http.post).toHaveBeenCalledWith('/reservations', payload);
  });

  it('loads and cancels reservations for a student', async () => {
    http.get.mockResolvedValue({ data: [reservation] });
    http.patch.mockResolvedValue({ data: { ...reservation, status: 'CANCELLED' } });

    await expect(fetchUserReservations('user-456')).resolves.toEqual([reservation]);
    await cancelReservation(reservation.id);

    expect(http.get).toHaveBeenCalledWith('/reservations/user/user-456');
    expect(http.patch).toHaveBeenCalledWith(`/reservations/${reservation.id}/cancel`);
  });

  it('turns a 409 double-booking response into an ApiError', async () => {
    http.post.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'DOUBLE_BOOKING',
          message: 'Resource is already reserved for this time slot.',
        },
      },
    });

    await expect(
      createReservation({
        resourceId: reservation.resourceId,
        userId: reservation.userId,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'DOUBLE_BOOKING',
      message: 'Resource is already reserved for this time slot.',
    });
    await expect(
      createReservation({
        resourceId: reservation.resourceId,
        userId: reservation.userId,
        startTime: reservation.startTime,
        endTime: reservation.endTime,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
