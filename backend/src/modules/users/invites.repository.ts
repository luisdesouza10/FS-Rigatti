import { Types, isValidObjectId } from 'mongoose';
import { InvitationModel } from '../../models/invitation.model';
import { createLinkToken, hashLinkToken } from '../../shared/linkToken';
import type { Role } from '../../shared/tenant';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const newToken = () => createLinkToken(INVITE_TTL_MS);

export const invitesRepository = {
  /** Creates or replaces the company's pending invite for this e-mail. Returns the plain token once. */
  async upsert(companyId: string, data: { email: string; name: string; role: Role; invitedBy: string }) {
    const { token, tokenHash, expiresAt } = newToken();
    const invite = await InvitationModel.findOneAndUpdate(
      { company_id: companyId, email: data.email.toLowerCase() },
      {
        $set: { name: data.name, role: data.role, invited_by: new Types.ObjectId(data.invitedBy), tokenHash, expiresAt },
        $setOnInsert: { company_id: new Types.ObjectId(companyId), email: data.email.toLowerCase() },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return { invite: invite!, token };
  },

  /** New token and expiry for an existing invite; the old link stops working. */
  async renew(companyId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    const { token, tokenHash, expiresAt } = newToken();
    const invite = await InvitationModel.findOneAndUpdate(
      { _id: id, company_id: companyId },
      { $set: { tokenHash, expiresAt } },
      { returnDocument: 'after' },
    );
    return invite ? { invite, token } : null;
  },

  listPending(companyId: string) {
    return InvitationModel.find({ company_id: companyId, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  },

  async delete(companyId: string, id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    return (await InvitationModel.deleteOne({ _id: id, company_id: companyId })).deletedCount === 1;
  },

  /** Invites only stay valid while whoever sent them is still an admin of the company. */
  deleteByInviter(companyId: string, inviterId: string) {
    return InvitationModel.deleteMany({ company_id: companyId, invited_by: new Types.ObjectId(inviterId) });
  },

  /** Unscoped on purpose: the invitee isn't signed in, the token is what identifies the invite. */
  findValidByToken(token: string) {
    return InvitationModel.findOne({ tokenHash: hashLinkToken(token), expiresAt: { $gt: new Date() } }).setOptions({
      skipTenantGuard: true,
    });
  },
};
