import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { CompanyModel } from '../../models/company.model';
import type { InvitationDocument } from '../../models/invitation.model';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { ROLES, getTenant } from '../../shared/tenant';
import { sendOrFail, type Mailer } from '../mail/mailer';
import { mailTemplates } from '../mail/templates';
import { invitesRepository } from './invites.repository';
import { usersRepository } from './users.repository';

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome').max(120),
  email: z.email('E-mail inválido').trim().toLowerCase().max(160),
  role: z.enum(ROLES).default('user'),
});

const updateUserSchema = z.object({ role: z.enum(ROLES) });

const LAST_ADMIN_MESSAGE = 'A empresa precisa de pelo menos um administrador';

async function inviteEmail(companyId: string, inviterId: string, invite: InvitationDocument, token: string) {
  const [company, inviter] = await Promise.all([
    CompanyModel.findById(companyId).select('name').lean(),
    usersRepository.findById(companyId, inviterId),
  ]);
  return mailTemplates.invite({
    to: invite.email,
    name: invite.name,
    companyName: company?.name ?? '',
    inviterName: inviter?.name ?? 'Um administrador',
    token,
  });
}

export function createUsersRouter(mailer: Mailer) {
  const usersRouter = Router();
  usersRouter.use(authenticate, requireRole('admin'));

  usersRouter.get('/', async (req, res) => {
    const { companyId } = getTenant(req);
    res.json({ items: await usersRepository.listByCompany(companyId) });
  });

  // Invites instead of admin-set passwords: the person picks their own when accepting.
  // The answer is the same whether or not the e-mail already has an account elsewhere,
  // so it can't be used to find out who uses the product (only a teammate is named).
  usersRouter.post('/invites', async (req, res) => {
    const { companyId, userId } = getTenant(req);
    const input = inviteSchema.parse(req.body);
    if ((await usersRepository.companyIdOfEmail(input.email)) === companyId) {
      throw new ConflictError('Esta pessoa já faz parte da equipe');
    }
    const { invite, token } = await invitesRepository.upsert(companyId, { ...input, invitedBy: userId });
    // The link only goes to the invitee's inbox, never back to the admin (F14).
    await sendOrFail(mailer, await inviteEmail(companyId, userId, invite, token), () =>
      invitesRepository.delete(companyId, invite.id),
    );
    res.status(201).json({ invite });
  });

  usersRouter.get('/invites', async (req, res) => {
    const { companyId } = getTenant(req);
    res.json({ items: await invitesRepository.listPending(companyId) });
  });

  usersRouter.post('/invites/:id/renew', async (req, res) => {
    const { companyId, userId } = getTenant(req);
    const renewed = await invitesRepository.renew(companyId, String(req.params.id));
    if (!renewed) throw new NotFoundError('Convite');
    // Resent by e-mail; the previous link already stopped working.
    await sendOrFail(mailer, await inviteEmail(companyId, userId, renewed.invite, renewed.token), async () => undefined);
    res.json({ invite: renewed.invite });
  });

  usersRouter.delete('/invites/:id', async (req, res) => {
    const { companyId } = getTenant(req);
    if (!(await invitesRepository.delete(companyId, String(req.params.id)))) throw new NotFoundError('Convite');
    res.status(204).end();
  });

  // Takes effect on the user's next request: authenticate reloads the role from the database.
  usersRouter.patch('/:id', async (req, res) => {
    const { companyId } = getTenant(req);
    const { role } = updateUserSchema.parse(req.body);
    const target = await usersRepository.findById(companyId, String(req.params.id));
    if (!target) throw new NotFoundError('Usuário');
    if (target.role === role) {
      res.json(target);
      return;
    }

    const updated = await usersRepository.setRole(companyId, target.id, role);
    // Checked after the write so two admins demoting each other at once can't both succeed.
    if (role !== 'admin' && (await usersRepository.countAdmins(companyId)) === 0) {
      await usersRepository.setRole(companyId, target.id, 'admin');
      throw new ConflictError(LAST_ADMIN_MESSAGE);
    }
    // A demoted admin's pending invites stop working, like those of a removed one.
    if (target.role === 'admin' && role !== 'admin') await invitesRepository.deleteByInviter(companyId, target.id);
    res.json(updated);
  });

  usersRouter.delete('/:id', async (req, res) => {
    const { companyId } = getTenant(req);
    const target = await usersRepository.findById(companyId, String(req.params.id));
    if (!target) throw new NotFoundError('Usuário');
    if (target.role === 'admin' && (await usersRepository.countAdmins(companyId)) <= 1) {
      throw new ConflictError(LAST_ADMIN_MESSAGE);
    }
    await usersRepository.delete(companyId, target.id);
    await invitesRepository.deleteByInviter(companyId, target.id);
    res.status(204).end();
  });

  return usersRouter;
}
