import { absentId, createResource } from '../../test/factories';
import { getResource, listResources, seedResources } from '../resource.service';

describe('listResources', () => {
  it('returns an empty list when no resources exist', async () => {
    expect(await listResources({})).toEqual([]);
  });

  it('returns every resource when no filter is given', async () => {
    const a = await createResource({ name: 'A' });
    const b = await createResource({ name: 'B', type: 'LAB' });

    const all = await listResources({});

    expect(all.map((resource) => resource.id)).toEqual([a.id, b.id].sort());
  });

  it('filters by type', async () => {
    await createResource({ type: 'ROOM' });
    const lab = await createResource({ type: 'LAB' });

    expect(await listResources({ type: 'LAB' })).toEqual([lab]);
  });

  it('treats isAvailable: false as a real filter, not as "no filter"', async () => {
    await createResource({ isAvailable: true });
    const broken = await createResource({ isAvailable: false });

    expect(await listResources({ isAvailable: false })).toEqual([broken]);
    expect(await listResources({ isAvailable: true })).toHaveLength(1);
  });

  it('combines filters with AND', async () => {
    await createResource({ type: 'ROOM', isAvailable: false });
    await createResource({ type: 'LAB', isAvailable: true });
    const match = await createResource({ type: 'LAB', isAvailable: false });

    expect(await listResources({ type: 'LAB', isAvailable: false })).toEqual([match]);
  });
});

describe('getResource', () => {
  it('returns the mapped resource for an existing id', async () => {
    const created = await createResource({ name: 'Printer', type: 'EQUIPMENT', location: 'Maker' });

    expect(await getResource(created.id)).toEqual({
      id: created.id,
      name: 'Printer',
      type: 'EQUIPMENT',
      location: 'Maker',
      isAvailable: true,
    });
  });

  it('returns undefined for an absent ObjectId', async () => {
    expect(await getResource(absentId())).toBeUndefined();
  });

  it.each(['', 'room-1', 'zzzzzzzzzzzzzzzzzzzzzzzz', '{"$gt":""}'])(
    'returns undefined for the non-ObjectId %j',
    async (id) => {
      expect(await getResource(id)).toBeUndefined();
    },
  );
});

describe('seedResources', () => {
  it('upserts by id so reseeding never duplicates or changes the id', async () => {
    const original = await createResource({ name: 'Old name' });

    const [updated] = await seedResources([{ ...original, name: 'New name' }]);

    expect(updated).toEqual({ ...original, name: 'New name' });
    expect(await listResources({})).toHaveLength(1);
  });

  it('rejects a blank name through schema validation', async () => {
    await expect(createResource({ name: '   ' })).rejects.toThrow();
  });

  it('rejects an over-long location', async () => {
    await expect(createResource({ location: 'x'.repeat(121) })).rejects.toThrow();
  });
});
