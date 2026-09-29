import { app } from './app';

const portValue: string = process.env.PORT ?? '3000';
const port: number = Number(portValue);

if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid PORT: expected an integer between 1 and 65535.');
  process.exitCode = 1;
} else {
  const server = app.listen(port, '127.0.0.1');

  server.once('listening', (): void => {
    console.log(`CampusHub listening at http://127.0.0.1:${port}`);
  });

  server.on('error', (error: NodeJS.ErrnoException): void => {
    console.error('Unable to start CampusHub:', error.message);
    process.exitCode = 1;
  });
}
