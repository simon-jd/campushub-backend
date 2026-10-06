import { model, Schema } from 'mongoose';
import type { User } from '../types/reservation';
import { isIdentifier } from '../validation/reservation.validation';

export const userSchema = new Schema<User>(
  {
    id: { type: String, required: true, unique: true, cast: false, validate: isIdentifier },
    name: { type: String, required: true, maxlength: 100, match: /\S/, cast: false },
  },
  { strict: 'throw', id: false, versionKey: false },
);

export const UserModel = model<User>('User', userSchema);
