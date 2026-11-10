import os from 'node:os';
import express from 'express';
import mongoose from 'mongoose';
import type { DatabaseConfig } from './config/environment';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { healthRouter } from './routes/health.routes';
import { reservationRouter } from './routes/reservation.routes';
import { resourceRouter } from './routes/resource.routes';

export const app = express();

app.use('/api/v1', healthRouter);
app.use('/api/v1', resourceRouter);
app.use('/api/v1', reservationRouter);
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection shell. Importing this module never connects; entry points call it with
// values from src/config so tests and scripts can choose an isolated database.
export async function connectDatabase(database: DatabaseConfig): Promise<void> {
  await mongoose.connect(database.uri, {
    dbName: database.dbName,
    serverSelectionTimeoutMS: 5000,
    // The driver otherwise loads `os` with a dynamic import() while building its handshake
    // metadata. That import fails inside Jest's VM sandbox, the handshake then omits the required
    // `driver` field, and MongoDB refuses the connection. Passing the module avoids the import.
    runtimeAdapters: { os },
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
