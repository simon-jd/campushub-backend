import { connectDatabase, disconnectDatabase } from '../app';
import { loadConfig } from '../config/environment';
import { seedResources } from '../services/resource.service';
import type { Resource } from '../types/reservation';

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

async function seed(): Promise<void> {
  const config = loadConfig(process.env);
  try {
    await connectDatabase(config.database);
    const resources = await seedResources(sampleResources);
    console.log(`Seeded ${resources.length} resources into ${config.database.dbName}:`);
    console.table(resources);
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
