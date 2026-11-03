import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../middleware/errorHandler';

test('unexpected failures keep the Lab 2 error contract', async (context: TestContext): Promise<void> => {
  const fixture = express();
  fixture.get('/sync', (): never => {
    throw new Error('private-sync-detail');
  });
  fixture.get('/async', (): Promise<never> => Promise.reject(new Error('private-async-detail')));
  fixture.get(
    '/started',
    (
      _request: Request<Record<string, string>, string, unknown>,
      response: Response<string>,
      next: NextFunction,
    ): void => {
      response.write('partial');
      next(new Error('private-stream-detail'));
    },
  );
  fixture.use(errorHandler);
  let forwarded = false;
  fixture.use(
    (
      error: unknown,
      _request: Request<Record<string, string>, string, unknown>,
      response: Response<string>,
      next: NextFunction,
    ): void => {
      if (!response.headersSent) {
        next(error);
        return;
      }
      forwarded = true;
      response.end('-finished');
    },
  );
  const server = fixture.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  context.after(async (): Promise<void> => {
    await new Promise<void>((resolve, reject): void => {
      server.close((error?: Error): void => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
  for (const path of ['/sync', '/async']) {
    const response: Awaited<ReturnType<typeof fetch>> = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
  }
  const partial = await fetch(`http://127.0.0.1:${address.port}/started`);
  assert.equal(await partial.text(), 'partial-finished');
  assert.equal(forwarded, true);
}).catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
