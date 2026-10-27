import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Resource } from '../api/campushubApi';
import { ResourceList } from './ResourceList';

const room: Resource = {
  id: '000000000000000000000101',
  name: 'Study Room 302',
  type: 'ROOM',
  location: 'Library, Floor 3',
  isAvailable: true,
};

const printer: Resource = {
  id: '000000000000000000000102',
  name: '3D Printer A',
  type: 'EQUIPMENT',
  location: 'Makerspace',
  isAvailable: false,
};

describe('ResourceList', () => {
  it('shows each resource and reports type filter and selection', async () => {
    const user = userEvent.setup();
    const onTypeFilterChange = vi.fn();
    const onSelect = vi.fn();

    render(
      <ResourceList
        resources={[room, printer]}
        isLoading={false}
        error={null}
        selectedId={room.id}
        typeFilter="ALL"
        onTypeFilterChange={onTypeFilterChange}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Study Room 302' })).toBeInTheDocument();
    expect(screen.getByText('Makerspace')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Study Room 302/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Labs' }));
    await user.click(screen.getByRole('button', { name: /3D Printer A/ }));

    expect(onTypeFilterChange).toHaveBeenCalledWith('LAB');
    expect(onSelect).toHaveBeenCalledWith(printer);
  });

  it('shows loading and error states', () => {
    render(
      <ResourceList
        resources={[]}
        isLoading
        error="The catalog could not be loaded."
        selectedId={null}
        typeFilter="ROOM"
        onTypeFilterChange={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('Loading resources...')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The catalog could not be loaded.');
  });
});
