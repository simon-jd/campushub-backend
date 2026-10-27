import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Reservation, Resource } from '../api/campushubApi';
import { UserReservations } from './UserReservations';

const room: Resource = {
  id: '000000000000000000000101',
  name: 'Study Room 302',
  type: 'ROOM',
  location: 'Library, Floor 3',
  isAvailable: true,
};

const active: Reservation = {
  id: '000000000000000000000201',
  resourceId: room.id,
  userId: 'user-456',
  startTime: '2026-10-27T10:00:00.000Z',
  endTime: '2026-10-27T11:00:00.000Z',
  status: 'CONFIRMED',
};

const cancelled: Reservation = {
  ...active,
  id: '000000000000000000000202',
  status: 'CANCELLED',
};

describe('UserReservations', () => {
  it('lists active bookings and cancels the selected one', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);

    render(
      <UserReservations
        reservations={[active, cancelled]}
        resourcesById={new Map([[room.id, room]])}
        isLoading={false}
        error={null}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Study Room 302')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(screen.queryByText('CANCELLED')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }));
    expect(onCancel).toHaveBeenCalledWith(active.id);
  });

  it('shows loading, empty, and error states', () => {
    const { rerender } = render(
      <UserReservations
        reservations={[]}
        resourcesById={new Map()}
        isLoading
        error="Your bookings could not be loaded."
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Loading reservations...')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your bookings could not be loaded.');

    rerender(
      <UserReservations
        reservations={[]}
        resourcesById={new Map()}
        isLoading={false}
        error={null}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('No active reservations.')).toBeInTheDocument();
  });
});
