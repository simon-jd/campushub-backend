import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { Types } from 'mongoose';
import { ReservationModel } from '../models/Reservation.model';
import { ResourceModel } from '../models/Resource.model';
import { UserModel } from '../models/User.model';

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
      // MongoDB's _id is the identity; an API-style id field is not a stored path.
      assert.throws((): unknown => new ResourceModel({ ...valid, id: 'res-101' }));
      assert.throws((): unknown => new ResourceModel({ ...valid, unexpected: true }));
    },
  );

  await context.test(
    'Reservation references Resource by ObjectId and enforces status and ordering',
    async (): Promise<void> => {
      const resourceId = ReservationModel.schema.path('resourceId');
      assert.equal(resourceId.instance, 'ObjectId');
      assert.equal(resourceId.options.ref, 'Resource');

      const valid = {
        resourceId: new Types.ObjectId(),
        userId: 'user-456',
        startTime: new Date('2099-10-01T10:00:00Z'),
        endTime: new Date('2099-10-01T11:00:00Z'),
        status: 'CONFIRMED',
      };
      for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED']) {
        await assert.doesNotReject(new ReservationModel({ ...valid, status }).validate());
      }
      for (const changes of [
        { resourceId: 'res-101' },
        { userId: '' },
        { userId: 42 },
        { status: 'DONE' },
        { startTime: 'not-a-date' },
        { endTime: new Date('2099-10-01T10:00:00Z') },
        { endTime: new Date('2099-10-01T09:00:00Z') },
      ]) {
        await assert.rejects(new ReservationModel({ ...valid, ...changes }).validate());
      }
      await assert.rejects(new ReservationModel({}).validate());
      assert.throws((): unknown => new ReservationModel({ ...valid, unexpected: true }));
    },
  );
}).catch((error: unknown): void => {
  console.error(error);
  process.exitCode = 1;
});
