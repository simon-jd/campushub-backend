import { connectDatabase, disconnectDatabase } from '../app';
import { loadConfig } from '../config/environment';
import { seedReservations } from '../services/reservation.service';
import { seedResources } from '../services/resource.service';
import type { Reservation, Resource } from '../types/reservation';

// Fixed ObjectIds mirror Lab 2's res-101 to res-104, so manual curl requests stay copyable.
const sampleResources: readonly Resource[] = [
  {
    id: '000000000000000000000101',
    name: 'Study Room 302',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: true,
  },
  {
    id: '000000000000000000000102',
    name: '3D Printer A',
    type: 'EQUIPMENT',
    location: 'Makerspace',
    isAvailable: true,
  },
  {
    id: '000000000000000000000103',
    name: 'Computer Lab 201',
    type: 'LAB',
    location: 'Science Building, Floor 2',
    isAvailable: true,
  },
  {
    id: '000000000000000000000104',
    name: 'Study Room 304',
    type: 'ROOM',
    location: 'Library, Floor 3',
    isAvailable: false,
  },
];

// One PENDING booking so PATCH /reservations/{id}/confirm has something to act on during
// manual checks. It sits on the lab resource at a far-future hour to stay clear of ad-hoc
// bookings, and reseeding returns it to PENDING so the transition can be retried.
const sampleReservations: readonly Reservation[] = [
  {
    id: '000000000000000000000201',
    resourceId: '000000000000000000000103',
    userId: 'user-456',
    startTime: '2099-12-31T09:00:00.000Z',
    endTime: '2099-12-31T10:00:00.000Z',
    status: 'PENDING',
  },
];

async function seed(): Promise<void> {
  const config = loadConfig(process.env);
  try {
    await connectDatabase(config.database);
    const resources = await seedResources(sampleResources);
    console.log(`Seeded ${resources.length} resources into ${config.database.dbName}:`);
    console.table(resources);
    const reservations = await seedReservations(sampleReservations);
    console.log(`Seeded ${reservations.length} reservations into ${config.database.dbName}:`);
    console.table(reservations);
  } finally {
    await disconnectDatabase();
  }
}

seed().catch((error: unknown): void => {
  console.error(
    'Unable to seed CampusHub resources:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
