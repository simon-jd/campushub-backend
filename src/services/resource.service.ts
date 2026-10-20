import { isObjectIdOrHexString } from 'mongoose';
import type { QueryFilter } from 'mongoose';
import type { ResourceFilter } from '../interfaces/resource-filter.interface';
import { ResourceModel } from '../models/Resource.model';
import type { ResourceDocument, ResourceRecord } from '../models/Resource.model';
import type { Resource } from '../types/reservation';

export async function listResources(filter: ResourceFilter): Promise<Resource[]> {
  // Each filter is added only when supplied, so `isAvailable: false` still narrows the query.
  const query: QueryFilter<ResourceRecord> = {};
  if (filter.type !== undefined) query.type = filter.type;
  if (filter.isAvailable !== undefined) query.isAvailable = filter.isAvailable;
  const documents = await ResourceModel.find(query).sort({ _id: 1 }).exec();
  return documents.map(toResource);
}

export async function getResource(id: string): Promise<Resource | undefined> {
  // Identifiers that cannot be ObjectIds match no resource, preserving Lab 2's 404 behavior.
  if (!isObjectIdOrHexString(id)) return undefined;
  const document = await ResourceModel.findById(id).exec();
  return document === null ? undefined : toResource(document);
}

// Upserting by id keeps ObjectIds stable, so reseeding never orphans existing reservations.
export async function seedResources(resources: readonly Resource[]): Promise<Resource[]> {
  const seeded: Resource[] = [];
  for (const { id, ...record } of resources) {
    const document = await ResourceModel.findOneAndUpdate({ _id: id }, record, {
      upsert: true,
      returnDocument: 'after',
      runValidators: true,
    })
      .orFail()
      .exec();
    seeded.push(toResource(document));
  }
  return seeded;
}

function toResource(document: ResourceDocument): Resource {
  return {
    id: document._id.toHexString(),
    name: document.name,
    type: document.type,
    location: document.location,
    isAvailable: document.isAvailable,
  };
}
