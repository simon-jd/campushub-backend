import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type Reservation, type Resource } from './api/campushubApi';
import App from './App';

const api = vi.hoisted(() => ({
  fetchResources: vi.fn(),
  fetchUserReservations: vi.fn(),
  createReservation: vi.fn(),
  cancelReservation: vi.fn(),
}));

vi.mock('./api/campushubApi', async () => {
  const actual = await vi.importActual<typeof import('./api/campushubApi')>('./api/campushubApi');
  return {
    ...actual,
    fetchResources: api.fetchResources,
    fetchUserReservations: api.fetchUserReservations,
    createReservation: api.createReservation,
    cancelReservation: api.cancelReservation,
  };
});

const room: Resource = {
  id: '000000000000000000000101',
  name: 'Study Room 302',
  type: 'ROOM',
  location: 'Library, Floor 3',
  isAvailable: true,
};

const lab: Resource = {
  id: '000000000000000000000103',
  name: 'Computer Lab 201',
  type: 'LAB',
  location: 'Science Building, Floor 2',
  isAvailable: true,
};

const reservation: Reservation = {
  id: '000000000000000000000301',
  resourceId: room.id,
  userId: 'user-456',
  startTime: '2026-10-27T17:00:00.000Z',
  endTime: '2026-10-27T18:00:00.000Z',
  status: 'CONFIRMED',
};

describe('App', () => {
  beforeEach(() => {
    api.fetchResources.mockReset();
    api.fetchUserReservations.mockReset();
    api.createReservation.mockReset();
    api.cancelReservation.mockReset();
    api.fetchResources.mockImplementation((type?: string) =>
      Promise.resolve(type === 'LAB' ? [lab] : [room, lab]),
    );
  });

  it('books a resource, shows a conflict on the second request, and cancels the booking', async () => {
    const user = userEvent.setup();
    api.fetchUserReservations
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([reservation])
      .mockResolvedValueOnce([]);
    api.createReservation
      .mockResolvedValueOnce(reservation)
      .mockRejectedValueOnce(
        new ApiError(409, 'DOUBLE_BOOKING', 'Resource is already reserved for this time slot.'),
      );
    api.cancelReservation.mockResolvedValue({ ...reservation, status: 'CANCELLED' });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Study Room 302' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Study Room 302/ }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-10-27T10:00' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-10-27T11:00' } });
    await user.click(screen.getByRole('button', { name: 'Book resource' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Reservation confirmed.');
    expect(await screen.findByText('CONFIRMED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Book resource' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This resource is already reserved for the selected time window.',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));
    await waitFor(() => {
      expect(screen.getByText('No active reservations.')).toBeInTheDocument();
    });
    expect(api.cancelReservation).toHaveBeenCalledWith(reservation.id);
  });

  it('clears a cancellation failure when switching students', async () => {
    const user = userEvent.setup();
    api.fetchUserReservations.mockResolvedValueOnce([reservation]).mockResolvedValueOnce([]);
    api.cancelReservation.mockRejectedValue(
      new ApiError(409, 'INVALID_STATE_TRANSITION', 'Already cancelled.'),
    );
    render(<App />);
    await screen.findByText('CONFIRMED');
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Already cancelled.');
    fireEvent.change(screen.getByLabelText('Student ID'), { target: { value: 'student-2' } });
    expect(await screen.findByText('No active reservations.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reloads the directory when the type filter changes', async () => {
    const user = userEvent.setup();
    api.fetchUserReservations.mockResolvedValue([]);

    render(<App />);
    await screen.findByRole('heading', { name: 'Study Room 302' });
    await user.click(screen.getByRole('button', { name: 'Labs' }));

    expect(await screen.findByRole('heading', { name: 'Computer Lab 201' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Study Room 302' })).not.toBeInTheDocument();
    expect(api.fetchResources).toHaveBeenCalledWith('LAB');
  });

  it('does not get stuck loading when the already-selected filter is clicked again', async () => {
    const user = userEvent.setup();
    api.fetchUserReservations.mockResolvedValue([]);

    render(<App />);
    await screen.findByRole('heading', { name: 'Study Room 302' });
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.queryByText('Loading resources...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Study Room 302' })).toBeInTheDocument();
    expect(api.fetchResources).toHaveBeenCalledTimes(1);
  });

  it('retries the catalog when the current filter is clicked after a load failure', async () => {
    const user = userEvent.setup();
    api.fetchUserReservations.mockResolvedValue([]);
    api.fetchResources.mockReset();
    api.fetchResources
      .mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Catalog is down.'))
      .mockResolvedValueOnce([room, lab]);

    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog is down.');
    await user.click(screen.getByRole('button', { name: 'All' }));

    expect(await screen.findByRole('heading', { name: 'Study Room 302' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.fetchResources).toHaveBeenCalledTimes(2);
  });
});
