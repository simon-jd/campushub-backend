// The only module that reads environment variables. Defaults are local development values.
const DEFAULT_PORT = '3000';
const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DEFAULT_MONGODB_DB_NAME = 'campushub';

export interface DatabaseConfig {
  uri: string;
  dbName: string;
}

export interface AppConfig {
  port: number;
  database: DatabaseConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: parsePort(env.PORT ?? DEFAULT_PORT),
    database: {
      uri: parseMongoUri(env.MONGODB_URI ?? DEFAULT_MONGODB_URI),
      dbName: parseDbName(env.MONGODB_DB_NAME ?? DEFAULT_MONGODB_DB_NAME),
    },
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT: expected an integer between 1 and 65535.');
  }
  return port;
}

function parseMongoUri(value: string): string {
  // The URI may contain credentials, so the error never echoes it.
  if (!/^mongodb(\+srv)?:\/\/\S+$/.test(value)) {
    throw new Error(
      'Invalid MONGODB_URI: expected a mongodb:// or mongodb+srv:// connection string.',
    );
  }
  return value;
}

function parseDbName(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(value)) {
    throw new Error(
      'Invalid MONGODB_DB_NAME: expected 1-63 letters, digits, underscores, or hyphens.',
    );
  }
  return value;
}
