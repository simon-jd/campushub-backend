import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Resource } from '../api/campushubApi';
import { BookingForm } from './BookingForm';

const room: Resource = {
  id: '000000000000000000000101',
  name: 'Study Room 302',
  type: 'ROOM',
  location: 'Library, Floor 3',
  isAvailable: true,
};

function setTime(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('BookingForm', () => {
  it('blocks submission until a resource and a valid time window are present', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <BookingForm resource={null} userId="user-456" onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole('button', { name: 'Book resource' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Select a resource before booking.');

    rerender(<BookingForm resource={room} userId="user-456" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Book resource' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a start and end time.');

    setTime('Start', '2026-10-27T12:00');
    setTime('End', '2026-10-27T11:00');
    await user.click(screen.getByRole('button', { name: 'Book resource' }));
    expect(screen.getByRole('alert')).toHaveTextContent('End time must be after the start time.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits an ISO reservation and shows a conflict alert when the slot is taken', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ApiError(409, 'DOUBLE_BOOKING', 'Resource is already reserved for this time slot.'),
      );

    render(<BookingForm resource={room} userId="user-456" onSubmit={onSubmit} />);
    setTime('Start', '2026-10-27T10:00');
    setTime('End', '2026-10-27T11:00');
    await user.click(screen.getByRole('button', { name: 'Book resource' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        resourceId: room.id,
        userId: 'user-456',
        startTime: new Date('2026-10-27T10:00').toISOString(),
        endTime: new Date('2026-10-27T11:00').toISOString(),
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Book resource' })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: 'Book resource' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This resource is already reserved for the selected time window.',
    );
  });

  it('shows the server message for other booking failures', async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError(409, 'RESOURCE_UNAVAILABLE', 'The resource is unavailable.'));

    render(<BookingForm resource={room} userId="user-456" onSubmit={onSubmit} />);
    setTime('Start', '2026-10-27T10:00');
    setTime('End', '2026-10-27T11:00');
    await user.click(screen.getByRole('button', { name: 'Book resource' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The resource is unavailable.');
  });
});
