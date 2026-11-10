import request from 'supertest';
import { app } from '../../app';
import * as reservationService from '../../services/reservation.service';
import * as resourceService from '../../services/resource.service';
import { absentId, at, bodyRecord, HOUR } from '../../test/factories';

// Controllers promise that an unexpected Service failure becomes a generic 500 INTERNAL_ERROR
// that never leaks internals. A real database cannot be made to fail on demand, so the Services
// are replaced with failing stubs for these tests only.
const SECRET = 'mongodb://user:hunter2@db.internal:27017/campushub';

describe('unexpected Service failures', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((): void => undefined);
  });

  it('maps a failing createReservation to 500 without leaking the error text', async () => {
    jest.spyOn(reservationService, 'createReservation').mockRejectedValue(new Error(SECRET));

    const response = await request(app)
      .post('/api/v1/reservations')
      .send({ resourceId: absentId(), userId: 'alice', startTime: at(0), endTime: at(HOUR) });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
  });

  it('maps a failing listUserReservations to 500', async () => {
    jest.spyOn(reservationService, 'listUserReservations').mockRejectedValue(new Error('boom'));

    const response = await request(app).get('/api/v1/reservations/user/alice');

    expect(response.status).toBe(500);
    expect(bodyRecord(response.body).code).toBe('INTERNAL_ERROR');
  });

  it('maps a failing updateReservationStatus to 500', async () => {
    jest.spyOn(reservationService, 'updateReservationStatus').mockRejectedValue(new Error('boom'));

    const response = await request(app).patch(`/api/v1/reservations/${absentId()}/cancel`);

    expect(response.status).toBe(500);
    expect(bodyRecord(response.body).code).toBe('INTERNAL_ERROR');
  });

  it('maps a failing listResources to 500', async () => {
    jest.spyOn(resourceService, 'listResources').mockRejectedValue(new Error('boom'));

    const response = await request(app).get('/api/v1/resources');

    expect(response.status).toBe(500);
    expect(bodyRecord(response.body).code).toBe('INTERNAL_ERROR');
  });

  it('logs only the error message, never the stack or request body', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation((): void => undefined);
    jest.spyOn(resourceService, 'listResources').mockRejectedValue(new Error('boom'));

    await request(app).get('/api/v1/resources');

    expect(logged).toHaveBeenCalledWith('Unhandled request error:', 'boom');
  });

  it('survives a non-Error rejection', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation((): void => undefined);
    jest.spyOn(resourceService, 'listResources').mockRejectedValue('just a string');

    const response = await request(app).get('/api/v1/resources');

    expect(response.status).toBe(500);
    expect(logged).toHaveBeenCalledWith('Unhandled request error:', 'Unknown error');
  });
});
