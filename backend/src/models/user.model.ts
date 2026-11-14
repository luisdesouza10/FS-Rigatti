import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { toJSONPlugin } from '../db/plugins/toJSON';
import { ROLES } from '../shared/tenant';

// No tenantGuard: login looks users up by (globally unique) email before the company is known.
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'user' },
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    /** Bumped on logout and password change; tokens carrying an older value stop working. */
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

userSchema.plugin(toJSONPlugin);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel = model('User', userSchema);
