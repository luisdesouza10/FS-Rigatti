import { Types, isValidObjectId } from 'mongoose';
import { ConversationModel } from '../../models/conversation.model';
import { UserModel } from '../../models/user.model';
import type { Role } from '../../shared/tenant';

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export const usersRepository = {
  /** The only unscoped query: login does not know the tenant yet. */
  findByEmailWithPassword(email: string) {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash +tokenVersion');
  },

  emailExists(email: string) {
    return UserModel.exists({ email: email.toLowerCase() });
  },

  /** Unscoped on purpose: e-mails are unique across companies. Never return this to the client. */
  async companyIdOfEmail(email: string): Promise<string | null> {
    const user = await UserModel.findOne({ email: email.toLowerCase() }).select('company_id').lean();
    return user ? String(user.company_id) : null;
  },

  findById(companyId: string, userId: string) {
    if (!isValidObjectId(userId)) return Promise.resolve(null);
    return UserModel.findOne({ _id: userId, company_id: companyId });
  },

  findByIdWithPassword(companyId: string, userId: string) {
    return UserModel.findOne({ _id: userId, company_id: companyId }).select('+passwordHash +tokenVersion');
  },

  listByCompany(companyId: string) {
    return UserModel.find({ company_id: companyId }).sort({ createdAt: 1 });
  },

  countAdmins(companyId: string) {
    return UserModel.countDocuments({ company_id: companyId, role: 'admin' });
  },

  create(companyId: string, data: NewUser) {
    return UserModel.create({ ...data, company_id: new Types.ObjectId(companyId) });
  },

  setRole(companyId: string, userId: string, role: Role) {
    return UserModel.findOneAndUpdate({ _id: userId, company_id: companyId }, { role }, { returnDocument: 'after' });
  },

  /** Ends every session of the user (see authenticate). Returns the new version. */
  async bumpTokenVersion(companyId: string, userId: string, set: Record<string, unknown> = {}) {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, company_id: companyId },
      { $set: set, $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    ).select('+tokenVersion');
    return user?.tokenVersion ?? null;
  },

  /** Also drops the user's chats, which nobody else can read. */
  async delete(companyId: string, userId: string): Promise<boolean> {
    const result = await UserModel.deleteOne({ _id: userId, company_id: companyId });
    if (result.deletedCount !== 1) return false;
    await ConversationModel.deleteMany({ company_id: companyId, user_id: userId });
    return true;
  },
};
