import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../app';

// Jest runs each test file in its own module registry, so every file gets a private in-memory
// MongoDB and its own Mongoose connection. Nothing here touches a developer or production database.
const TEST_DB_NAME = 'campushub-test';

let server: MongoMemoryServer | undefined;

beforeAll(async (): Promise<void> => {
  server = await MongoMemoryServer.create();
  await connectDatabase({ uri: server.getUri(), dbName: TEST_DB_NAME });
  // Build indexes up front so the first test does not race index creation.
  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.init()));
}, 120_000);

// Empty the collections (keeping their indexes) so tests never see each other's documents.
afterEach(async (): Promise<void> => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})),
  );
});

afterAll(async (): Promise<void> => {
  await disconnectDatabase();
  await server?.stop();
});
