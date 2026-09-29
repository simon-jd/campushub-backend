import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { ResourceModel } from '../models/resource.model';
import { ReservationModel } from '../models/reservation.model';
import { UserModel } from '../models/user.model';

test('Mongoose schemas validate without a database', async (context: TestContext): Promise<void> => {
  await context.test('User requires a valid ID and a non-blank name', async (): Promise<void> => {
    await assert.doesNotReject(
      new UserModel({ id: 'user-456', name: 'Example Student' }).validate(),
    );
    for (const data of [
      {},
      { id: ' ', name: 'A' },
      { id: 'user-456', name: ' ' },
      { id: 'user-456', name: 12 },
    ]) {
      await assert.rejects(new UserModel(data).validate());
    }
  });

  await context.test(
    'Resource requires the domain enum, location and a boolean',
    async (): Promise<void> => {
      const valid = {
        id: 'res-101',
        name: 'Study Room',
        type: 'ROOM',
        location: 'Library',
        isAvailable: true,
      };
      await assert.doesNotReject(new ResourceModel(valid).validate());
      for (const changes of [
        { type: 'STUDY_ROOM' },
        { location: '' },
        { isAvailable: 'true' },
        { name: ' '.repeat(2) },
      ]) {
        await assert.rejects(new ResourceModel({ ...valid, ...changes }).validate());
      }
      assert.throws((): unknown => new ResourceModel({ ...valid, unexpected: true }));
    },
  );

  await context.test(
    'Reservation enforces required values, status, UUID and interval ordering',
    async (): Promise<void> => {
      const valid = {
        id: 'eecdbed0-907b-4737-860b-a6b22f6f85e0',
        resourceId: 'res-101',
        userId: 'user-456',
        startTime: '2099-10-01T10:00:00Z',
        endTime: '2099-10-01T11:00:00Z',
        status: 'CONFIRMED',
      };
      for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED']) {
        await assert.doesNotReject(new ReservationModel({ ...valid, status }).validate());
      }
      for (const changes of [
        { id: 'bad' },
        { userId: '' },
        { status: 'DONE' },
        { startTime: '2099-02-29T10:00:00Z' },
        { endTime: '2099-10-01T10:00:00Z' },
        { endTime: '2099-10-01T09:00:00Z' },
      ]) {
        await assert.rejects(new ReservationModel({ ...valid, ...changes }).validate());
      }
      await assert.rejects(new ReservationModel({}).validate());
    },
  );
}).catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
