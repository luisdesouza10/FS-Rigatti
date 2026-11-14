import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A sign-up waiting for its e-mail to be confirmed. The company and the admin are only
 * created when the link is opened, so nobody gets an account under someone else's e-mail.
 * No tenantGuard: there is no company yet. Only the token's SHA-256 is stored.
 */
const pendingSignupSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB removes expired sign-ups on its own.
pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PendingSignup = InferSchemaType<typeof pendingSignupSchema>;
export type PendingSignupDocument = HydratedDocument<PendingSignup>;
export const PendingSignupModel = model('PendingSignup', pendingSignupSchema);
