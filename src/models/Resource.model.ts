import { model, Schema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import type { ResourceType } from '../types/reservation';

// Stored fields only. MongoDB's _id is the API id; Services map documents to API records.
export interface ResourceRecord {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

export type ResourceDocument = HydratedDocument<ResourceRecord>;

export const resourceSchema = new Schema<ResourceRecord>(
  {
    name: { type: String, required: true, maxlength: 120, match: /\S/, cast: false },
    type: { type: String, required: true, enum: ['ROOM', 'EQUIPMENT', 'LAB'], cast: false },
    location: { type: String, required: true, maxlength: 120, match: /\S/, cast: false },
    isAvailable: { type: Boolean, required: true, cast: false },
  },
  { strict: 'throw', id: false, versionKey: false },
);

export const ResourceModel = model<ResourceRecord>('Resource', resourceSchema);
