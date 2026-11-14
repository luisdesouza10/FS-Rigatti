import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { CompanyModel, type CompanyDocument } from '../../models/company.model';
import { PendingSignupModel } from '../../models/pendingSignup.model';
import type { UserDocument } from '../../models/user.model';
import { AppError, BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors';
import { createLinkToken, hashLinkToken } from '../../shared/linkToken';
import { normalizeText } from '../../shared/text';
import { sendOrFail, type Mailer } from '../mail/mailer';
import { mailTemplates } from '../mail/templates';
import { usersRepository } from '../users/users.repository';
import { invitesRepository } from '../users/invites.repository';
import type { AcceptInviteInput, ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas';
import { signToken } from './token';

export const PASSWORD_SALT_ROUNDS = 10;

// Compared against when the email does not exist, so response time doesn't reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', PASSWORD_SALT_ROUNDS);

export interface AuthResult {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  company: { id: string; name: string };
}

function buildAuthResult(user: UserDocument, company: CompanyDocument): AuthResult {
  return {
    token: signToken({ userId: user.id, companyId: company.id, role: user.role, tokenVersion: user.tokenVersion ?? 0 }),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    company: { id: company.id, name: company.name },
  };
}

function slugify(name: string): string {
  const base = normalizeText(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${base || 'company'}-${randomBytes(3).toString('hex')}`;
}

const SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;
const INVALID_SIGNUP_LINK = () => new AppError(404, 'Link de confirmação inválido ou expirado', 'NOT_FOUND');

/** Creates the company and its first admin (after the e-mail was confirmed). */
async function createCompanyWithAdmin(data: { companyName: string; name: string; email: string; passwordHash: string }) {
  const company = await CompanyModel.create({ name: data.companyName, slug: slugify(data.companyName) });
  try {
    const user = await usersRepository.create(company.id, {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: 'admin',
    });
    return buildAuthResult(user, company);
  } catch (err) {
    // Manual rollback: standalone Mongo has no transactions.
    await CompanyModel.deleteOne({ _id: company._id });
    if ((err as { code?: number }).code === 11000) throw new ConflictError('Este e-mail já tem uma conta. Entre com ele.');
    throw err;
  }
}

/** Stores the sign-up until its e-mail is confirmed and sends the confirmation link. */
async function startPendingSignup(input: RegisterInput, passwordHash: string, mailer: Mailer) {
  const { token, tokenHash, expiresAt } = createLinkToken(SIGNUP_TTL_MS);
  // Registering again before confirming replaces the pending sign-up (and its link).
  await PendingSignupModel.findOneAndUpdate(
    { email: input.email },
    { $set: { name: input.name, companyName: input.companyName, passwordHash, tokenHash, expiresAt } },
    { upsert: true },
  );
  await sendOrFail(
    mailer,
    mailTemplates.confirmSignup({ to: input.email, name: input.name, companyName: input.companyName, token }),
    () => PendingSignupModel.deleteOne({ email: input.email }),
  );
}

const INVALID_INVITE = () => new AppError(404, 'Convite inválido ou expirado', 'NOT_FOUND');
// Shown to the invitee only (they own the e-mail); the admin never sees it.
const EMAIL_HAS_ACCOUNT = 'Este e-mail já tem uma conta. Entre com ele ou peça um convite para outro e-mail.';

export const authService = {
  /**
   * Nothing is created yet: the e-mail's owner must open the confirmation link first.
   * The answer is the same whether or not the e-mail already has an account; in that
   * case its owner gets a warning e-mail instead of a link. The password is hashed in
   * both paths so response time doesn't tell them apart either.
   */
  async register(input: RegisterInput, mailer: Mailer): Promise<{ message: string }> {
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

    if (await usersRepository.emailExists(input.email)) {
      await sendOrFail(mailer, mailTemplates.signupAttemptOnExistingAccount({ to: input.email }), async () => undefined);
    } else {
      await startPendingSignup(input, passwordHash, mailer);
    }
    return { message: `Enviamos um link de confirmação para ${input.email}. Abra o e-mail para terminar o cadastro.` };
  },

  /** Opening the link proves the e-mail is theirs: only now the company and the admin exist. */
  async confirmEmail(token: string): Promise<AuthResult> {
    // Fetch-and-delete in one step: two clicks at once can't both create a company.
    const pending = await PendingSignupModel.findOneAndDelete({
      tokenHash: hashLinkToken(token),
      expiresAt: { $gt: new Date() },
    }).select('+passwordHash');
    if (!pending) throw INVALID_SIGNUP_LINK();
    if (await usersRepository.emailExists(pending.email)) throw new ConflictError('Este e-mail já tem uma conta. Entre com ele.');

    return createCompanyWithAdmin({
      companyName: pending.companyName,
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
    });
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await usersRepository.findByEmailWithPassword(input.email);
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) throw new UnauthorizedError('E-mail ou senha incorretos');

    const company = await CompanyModel.findById(user.company_id);
    if (!company) throw new UnauthorizedError('E-mail ou senha incorretos');

    return buildAuthResult(user, company);
  },

  /** What the invite page shows before the person sets a password. */
  async inviteInfo(token: string) {
    const invite = await invitesRepository.findValidByToken(token);
    const company = invite && (await CompanyModel.findById(invite.company_id));
    if (!invite || !company) throw INVALID_INVITE();
    return { companyName: company.name, email: invite.email, name: invite.name };
  },

  /** Creates the account in the inviting company with the invited role; the invite is single use. */
  async acceptInvite(input: AcceptInviteInput): Promise<AuthResult> {
    const invite = await invitesRepository.findValidByToken(input.token);
    const company = invite && (await CompanyModel.findById(invite.company_id));
    if (!invite || !company) throw INVALID_INVITE();
    if (await usersRepository.emailExists(invite.email)) throw new ConflictError(EMAIL_HAS_ACCOUNT);

    let user: UserDocument;
    try {
      user = await usersRepository.create(company.id, {
        name: invite.name,
        email: invite.email,
        role: invite.role,
        passwordHash: await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS),
      });
    } catch (err) {
      // Same e-mail accepted twice at once: the unique index lets only one through.
      if ((err as { code?: number }).code === 11000) throw new ConflictError(EMAIL_HAS_ACCOUNT);
      throw err;
    }
    await invitesRepository.delete(company.id, invite.id);
    return buildAuthResult(user, company);
  },

  /** Ends every session of the user, on all devices. */
  async logout(companyId: string, userId: string): Promise<void> {
    await usersRepository.bumpTokenVersion(companyId, userId);
  },

  /** Requires the current password; other sessions end and this one gets a fresh token. */
  async changePassword(companyId: string, userId: string, input: ChangePasswordInput): Promise<AuthResult> {
    const user = await usersRepository.findByIdWithPassword(companyId, userId);
    if (!user) throw new UnauthorizedError('Sessão inválida');
    // 400, not 401: a 401 would make the frontend log the user out.
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new BadRequestError('Senha atual incorreta', [{ field: 'currentPassword', message: 'Senha atual incorreta' }]);
    }

    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    const tokenVersion = await usersRepository.bumpTokenVersion(companyId, userId, { passwordHash });
    const company = await CompanyModel.findById(companyId);
    if (tokenVersion == null || !company) throw new UnauthorizedError('Sessão inválida');
    user.tokenVersion = tokenVersion;
    return buildAuthResult(user, company);
  },

  async me(companyId: string, userId: string) {
    const [user, company] = await Promise.all([
      usersRepository.findById(companyId, userId),
      CompanyModel.findById(companyId),
    ]);
    if (!user || !company) throw new NotFoundError('Usuário');
    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: company.id, name: company.name },
    };
  },
};
