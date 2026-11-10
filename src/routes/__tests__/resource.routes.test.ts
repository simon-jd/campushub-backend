import request from 'supertest';
import { app } from '../../app';
import { bodyRecord, createResource } from '../../test/factories';

const RESOURCES = '/api/v1/resources';

async function names(query = ''): Promise<string[]> {
  const response = await request(app).get(`${RESOURCES}${query}`);
  expect(response.status).toBe(200);
  return (response.body as unknown[]).map((item) => String(bodyRecord(item).name)).sort();
}

describe('GET /api/v1/resources', () => {
  beforeEach(async () => {
    await createResource({ name: 'Room A', type: 'ROOM', isAvailable: true });
    await createResource({ name: 'Room B', type: 'ROOM', isAvailable: false });
    await createResource({ name: 'Printer', type: 'EQUIPMENT', isAvailable: true });
    await createResource({ name: 'Lab 1', type: 'LAB', isAvailable: false });
  });

  it('returns 200 with every resource when no filter is supplied', async () => {
    const response = await request(app).get(RESOURCES);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(await names()).toEqual(['Lab 1', 'Printer', 'Room A', 'Room B']);
  });

  it('returns the documented resource shape', async () => {
    const response = await request(app).get(`${RESOURCES}?type=EQUIPMENT`);

    expect(response.body).toEqual([
      {
        id: bodyRecord((response.body as unknown[])[0]).id,
        name: 'Printer',
        type: 'EQUIPMENT',
        location: 'Library',
        isAvailable: true,
      },
    ]);
  });

  it('filters by type', async () => {
    expect(await names('?type=ROOM')).toEqual(['Room A', 'Room B']);
    expect(await names('?type=LAB')).toEqual(['Lab 1']);
  });

  it('accepts STUDY_ROOM as an alias for ROOM', async () => {
    expect(await names('?type=STUDY_ROOM')).toEqual(['Room A', 'Room B']);
  });

  it('filters by isAvailable=true', async () => {
    expect(await names('?isAvailable=true')).toEqual(['Printer', 'Room A']);
  });

  it('treats isAvailable=false as a real filter', async () => {
    expect(await names('?isAvailable=false')).toEqual(['Lab 1', 'Room B']);
  });

  it('combines type and isAvailable', async () => {
    expect(await names('?type=ROOM&isAvailable=false')).toEqual(['Room B']);
  });

  it('returns an empty array when nothing matches', async () => {
    expect(await names('?type=EQUIPMENT&isAvailable=false')).toEqual([]);
  });

  it.each([
    ['an unknown type', '?type=SPACESHIP'],
    ['a lower-case type', '?type=room'],
    ['an empty type', '?type='],
    ['a repeated type', '?type=ROOM&type=LAB'],
    ['a bracketed type object', '?type[$ne]=ROOM'],
    ['a numeric isAvailable', '?isAvailable=1'],
    ['a capitalised boolean', '?isAvailable=True'],
    ['an empty isAvailable', '?isAvailable='],
    ['a repeated isAvailable', '?isAvailable=true&isAvailable=false'],
  ])('returns 400 for %s', async (_label, query) => {
    const response = await request(app).get(`${RESOURCES}${query}`);

    expect(response.status).toBe(400);
    expect(bodyRecord(response.body).code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for an unsupported query parameter', async () => {
    const response = await request(app).get(`${RESOURCES}?location=Library`);

    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/resources on an empty catalogue', () => {
  it('returns 200 and []', async () => {
    const response = await request(app).get(RESOURCES);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
