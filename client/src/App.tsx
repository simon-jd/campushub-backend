import { useEffect, useState, type ReactElement } from 'react';
import {
  describeApiError,
  fetchResources,
  isStudentId,
  type Resource,
  type ResourceType,
} from './api/campushubApi';
import { useReservations } from './hooks/useReservations';
import { BookingForm } from './components/BookingForm';
import { ResourceList } from './components/ResourceList';
import { UserReservations } from './components/UserReservations';

export default function App(): ReactElement {
  const [userId, setUserId] = useState('user-456');
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'ALL'>('ALL');
  const [resources, setResources] = useState<Resource[]>([]);
  const [knownResources, setKnownResources] = useState<ReadonlyMap<string, Resource>>(new Map());
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Resource | null>(null);
  const {
    reservations,
    isLoading: reservationsLoading,
    error: reservationsError,
    book: handleBook,
    cancel: handleCancel,
  } = useReservations(userId);

  useEffect(() => {
    let active = true;
    fetchResources(typeFilter === 'ALL' ? undefined : typeFilter)
      .then((next: Resource[]) => {
        if (!active) {
          return;
        }
        setResources(next);
        setKnownResources((current) => {
          const merged = new Map(current);
          for (const resource of next) {
            merged.set(resource.id, resource);
          }
          return merged;
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setResourcesError(describeApiError(error, 'The catalog could not be loaded.'));
      })
      .finally(() => {
        if (active) {
          setResourcesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [typeFilter]);

  function selectType(type: ResourceType | 'ALL'): void {
    setTypeFilter(type);
    setResourcesLoading(true);
    setResourcesError(null);
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-stone-900">
      <header className="border-b border-stone-800 bg-stone-950 text-stone-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-xs font-semibold tracking-[0.22em] text-amber-200 uppercase">
            CampusHub
          </p>
          <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight">
            Reserve a study room, lab, or piece of equipment.
          </h1>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)]">
        <ResourceList
          resources={resources}
          isLoading={resourcesLoading}
          error={resourcesError}
          selectedId={selected?.id ?? null}
          typeFilter={typeFilter}
          onTypeFilterChange={selectType}
          onSelect={setSelected}
        />
        <div className="grid content-start gap-6">
          <label className="grid gap-1 text-sm font-semibold text-stone-800">
            Student ID
            <input
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
              }}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-normal"
              autoComplete="off"
            />
          </label>
          <BookingForm resource={selected} userId={userId} onSubmit={handleBook} />
          <UserReservations
            key={userId}
            reservations={isStudentId(userId) ? reservations : []}
            resourcesById={knownResources}
            isLoading={isStudentId(userId) && reservationsLoading}
            error={
              isStudentId(userId)
                ? reservationsError
                : 'Enter a student ID using letters, numbers, hyphens, or underscores.'
            }
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}
