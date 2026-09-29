import { model, Schema } from 'mongoose';
import type { Resource } from '../types/reservation';
import { isIdentifier } from '../validation/reservation.validation';

export const resourceSchema = new Schema<Resource>(
  {
    id: { type: String, required: true, unique: true, cast: false, validate: isIdentifier },
    name: { type: String, required: true, maxlength: 120, match: /\S/, cast: false },
    type: { type: String, required: true, enum: ['ROOM', 'EQUIPMENT', 'LAB'], cast: false },
    location: { type: String, required: true, maxlength: 120, match: /\S/, cast: false },
    isAvailable: { type: Boolean, required: true, cast: false },
  },
  { strict: 'throw', id: false, versionKey: false },
);

export const ResourceModel = model<Resource>('Resource', resourceSchema);
