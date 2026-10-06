import type { Server } from 'node:http';
import { app, connectDatabase, disconnectDatabase } from './app';
import { loadConfig } from './config/environment';

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function closeDatabase(): void {
  disconnectDatabase().catch((error: unknown): void => {
    console.error('Unable to close the database connection:', describeError(error));
    process.exitCode = 1;
  });
}

function shutdown(server: Server): void {
  server.close((): void => {
    closeDatabase();
  });
}

async function start(): Promise<void> {
  const config = loadConfig(process.env);
  // Connect first so the server never accepts requests it cannot persist.
  await connectDatabase(config.database);

  const server = app.listen(config.port, '127.0.0.1');

  server.once('listening', (): void => {
    console.log(`CampusHub listening at http://127.0.0.1:${config.port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException): void => {
    console.error('Unable to start CampusHub:', error.message);
    process.exitCode = 1;
    // An open database connection would otherwise keep the failed process alive.
    closeDatabase();
  });

  process.once('SIGINT', (): void => shutdown(server));
  process.once('SIGTERM', (): void => shutdown(server));
}

start().catch((error: unknown): void => {
  console.error('Unable to start CampusHub:', describeError(error));
  process.exitCode = 1;
  closeDatabase();
});
