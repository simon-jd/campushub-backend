import type { ReactElement } from 'react';
import type { Resource, ResourceType } from '../api/campushubApi';

export interface ResourceListProps {
  resources: Resource[];
  isLoading: boolean;
  error: string | null;
  selectedId: string | null;
  typeFilter: ResourceType | 'ALL';
  onTypeFilterChange: (type: ResourceType | 'ALL') => void;
  onSelect: (resource: Resource) => void;
}

const FILTERS: readonly { id: ResourceType | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'ROOM', label: 'Study Rooms' },
  { id: 'EQUIPMENT', label: 'Equipment' },
  { id: 'LAB', label: 'Labs' },
];

export function ResourceList({
  resources,
  isLoading,
  error,
  selectedId,
  typeFilter,
  onTypeFilterChange,
  onSelect,
}: ResourceListProps): ReactElement {
  return (
    <section className="rounded-2xl border border-stone-300 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-amber-800 uppercase">
            Directory
          </p>
          <h2 className="mt-1 text-2xl text-stone-900">Campus resources</h2>
        </div>
        <div role="group" aria-label="Resource type" className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={typeFilter === filter.id}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                typeFilter === filter.id
                  ? 'bg-stone-900 text-amber-50'
                  : 'bg-stone-100 text-stone-700'
              }`}
              onClick={() => {
                onTypeFilterChange(filter.id);
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <p className="mt-4 text-sm text-stone-600">Loading resources...</p> : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {!isLoading && resources.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No resources match this filter.</p>
      ) : null}

      <ul className="mt-4 grid gap-3">
        {resources.map((resource) => {
          const selected = resource.id === selectedId;
          return (
            <li key={resource.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelect(resource);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  selected ? 'border-amber-700 bg-amber-50' : 'border-stone-200 bg-stone-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-stone-900">{resource.name}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-stone-600">
                    {resource.type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-600">{resource.location}</p>
                <p className="mt-2 text-sm font-medium text-stone-800">
                  {resource.isAvailable ? 'Available' : 'Unavailable'}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
