import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { tenantGuard } from '../db/plugins/tenantGuard';
import { toJSONPlugin } from '../db/plugins/toJSON';
import { ROLES } from '../shared/tenant';

/**
 * A pending invite. The link carries a random token; only its SHA-256 is stored,
 * so a database leak doesn't hand out working links.
 */
const invitationSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, enum: ROLES, required: true, default: 'user' },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invited_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// One pending invite per e-mail per company; inviting again replaces it.
invitationSchema.index({ company_id: 1, email: 1 }, { unique: true });
// MongoDB removes expired invites on its own.
invitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

invitationSchema.plugin(tenantGuard);
invitationSchema.plugin(toJSONPlugin);

export type Invitation = InferSchemaType<typeof invitationSchema>;
export type InvitationDocument = HydratedDocument<Invitation>;
export const InvitationModel = model('Invitation', invitationSchema);
