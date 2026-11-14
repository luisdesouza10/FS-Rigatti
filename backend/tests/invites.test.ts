import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { InvitationModel } from '../src/models/invitation.model';
import { UserModel } from '../src/models/user.model';
import { FakeMailer, HOME_PRODUCTS, TECH_PRODUCTS, auth, clearDb, createTenant, createUser, sessionToken, startDb, stopDb } from './helpers';

const mailer = new FakeMailer();
const app = createApp({ mailer });
let A: Awaited<ReturnType<typeof createTenant>>;
let B: Awaited<ReturnType<typeof createTenant>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mailer.clear();
  mailer.fail = false;
  A = await createTenant('TechNova', TECH_PRODUCTS);
  B = await createTenant('Casa Bella', HOME_PRODUCTS);
});

const invite = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/users/invites').set(auth(token)).send({ name: 'Maria', role: 'user', ...body });

const accept = (token: string | undefined, password = 'password12345') =>
  request(app).post('/api/auth/accept-invite').send({ token, password });

/** The link only reaches the invitee's inbox. */
const linkFor = (email: string) => mailer.lastToken(email, 'convite');

describe('invites: what the admin sees (F07, F14)', () => {
  it('should e-mail the link to the invitee and never return it to the admin', async () => {
    const res = await invite(A.admin.token, { email: 'new.person@example.com' }).expect(201);
    expect(res.body.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/convite\/|token/i);

    const [mail] = mailer.to('new.person@example.com');
    expect(mail?.subject).toMatch(/TechNova/);
    expect(linkFor('new.person@example.com')).toBeTypeOf('string');
  });

  it("should answer an e-mail from another company exactly like a new e-mail", async () => {
    const fresh = await invite(A.admin.token, { email: 'new.person@example.com' }).expect(201);
    const taken = await invite(A.admin.token, { email: 'admin@casa-bella.test' }).expect(201);

    const shape = (body: { invite: Record<string, unknown> }) => ({
      keys: Object.keys(body).sort(),
      inviteKeys: Object.keys(body.invite).sort(),
    });
    expect(shape(taken.body)).toEqual(shape(fresh.body));
    expect(JSON.stringify(taken.body)).not.toMatch(/em uso|existe|conta|outra empresa/i);
  });

  it('should still say plainly when the person is already on your own team', async () => {
    const res = await invite(A.admin.token, { email: 'user@technova.test' }).expect(409);
    expect(res.body.error.message).toMatch(/já faz parte da equipe/);
    expect(mailer.sent).toHaveLength(0);
  });

  it('should answer 503 and keep no invite when the e-mail cannot be sent', async () => {
    mailer.fail = true;
    await invite(A.admin.token, { email: 'new.person@example.com' }).expect(503);
    expect(await InvitationModel.countDocuments({ company_id: A.companyId })).toBe(0);
  });

  it('should no longer let the admin create a user with a password', async () => {
    await request(app)
      .post('/api/users')
      .set(auth(A.admin.token))
      .send({ name: 'John', email: 'john@tech.com', password: 'password12345' })
      .expect(404);
  });

  it('should be admin-only', async () => {
    await invite(A.user.token, { email: 'x@example.com' }).expect(403);
    await request(app).get('/api/users/invites').set(auth(A.user.token)).expect(403);
  });
});

describe('invites: accepting', () => {
  it('should show the invite and create the account in the inviting company with the chosen role', async () => {
    await invite(A.admin.token, { email: 'maria@example.com', role: 'admin' }).expect(201);
    const token = linkFor('maria@example.com')!;

    const info = await request(app).get(`/api/auth/invites/${token}`).expect(200);
    expect(info.body).toEqual({ companyName: 'TechNova', email: 'maria@example.com', name: 'Maria' });

    const res = await accept(token).expect(201);
    expect(res.body.user).toMatchObject({ email: 'maria@example.com', role: 'admin', name: 'Maria' });
    expect(res.body.company.id).toBe(A.companyId);
    await request(app).get('/api/users').set(auth(sessionToken(res)!)).expect(200);

    // Single use.
    await accept(token).expect(404);
    await request(app).get(`/api/auth/invites/${token}`).expect(404);
  });

  it('should tell only the invitee when the e-mail already has an account', async () => {
    await invite(A.admin.token, { email: 'admin@casa-bella.test' }).expect(201);
    const res = await accept(linkFor('admin@casa-bella.test')).expect(409);
    expect(res.body.error.message).toMatch(/já tem uma conta/);
    expect(await UserModel.countDocuments({ company_id: A.companyId, email: 'admin@casa-bella.test' })).toBe(0);
  });

  it('should reject an unknown or expired token', async () => {
    await accept('not-a-real-token-not-a-real-token-xx').expect(404);

    await invite(A.admin.token, { email: 'late@example.com' }).expect(201);
    await InvitationModel.updateMany({ company_id: A.companyId }, { expiresAt: new Date(Date.now() - 1000) });
    await accept(linkFor('late@example.com')).expect(404);
  });

  it('should apply the password rules (72 bytes, visible characters)', async () => {
    await invite(A.admin.token, { email: 'rules@example.com' }).expect(201);
    const token = linkFor('rules@example.com');
    await accept(token, 'a'.repeat(73)).expect(400);
    await accept(token, ' '.repeat(10)).expect(400);
    await accept(token, 'good-password').expect(201);
  });
});

describe('invites: managing pending ones', () => {
  it('should list pending invites of the own company only, without the token', async () => {
    await invite(A.admin.token, { email: 'one@example.com' }).expect(201);
    await invite(B.admin.token, { email: 'two@example.com' }).expect(201);

    const list = await request(app).get('/api/users/invites').set(auth(A.admin.token)).expect(200);
    expect(list.body.items.map((i: { email: string }) => i.email)).toEqual(['one@example.com']);
    expect(JSON.stringify(list.body)).not.toMatch(/token/i);
  });

  it('should replace the pending invite when the same e-mail is invited again', async () => {
    await invite(A.admin.token, { email: 'again@example.com' }).expect(201);
    const first = linkFor('again@example.com');
    await invite(A.admin.token, { email: 'again@example.com', role: 'admin' }).expect(201);
    const second = linkFor('again@example.com');
    expect(await InvitationModel.countDocuments({ company_id: A.companyId })).toBe(1);
    await accept(first).expect(404);
    expect((await accept(second).expect(201)).body.user.role).toBe('admin');
  });

  it('should resend a new link by e-mail, invalidating the old one, and cancel invites', async () => {
    const { body } = await invite(A.admin.token, { email: 'link@example.com' }).expect(201);
    const first = linkFor('link@example.com');

    const renewed = await request(app).post(`/api/users/invites/${body.invite.id}/renew`).set(auth(A.admin.token)).expect(200);
    expect(renewed.body.token).toBeUndefined();
    const second = linkFor('link@example.com');
    expect(second).not.toBe(first);
    expect(mailer.to('link@example.com')).toHaveLength(2);
    await accept(first).expect(404);

    await request(app).delete(`/api/users/invites/${body.invite.id}`).set(auth(A.admin.token)).expect(204);
    await accept(second).expect(404);
  });

  it("should answer 404 when an admin touches another company's invite", async () => {
    const { body } = await invite(B.admin.token, { email: 'theirs@example.com' }).expect(201);
    await request(app).delete(`/api/users/invites/${body.invite.id}`).set(auth(A.admin.token)).expect(404);
    await request(app).post(`/api/users/invites/${body.invite.id}/renew`).set(auth(A.admin.token)).expect(404);
    await accept(linkFor('theirs@example.com')).expect(201);
  });
});

describe('invites: when the inviter loses admin rights (F15)', () => {
  async function secondAdminWithInvite(email: string) {
    const second = await createUser(A.companyId, 'admin', 'second@technova.test');
    await invite(second.token, { email }).expect(201);
    await invite(A.admin.token, { email: 'kept@example.com' }).expect(201);
    return second;
  }

  it("should delete the pending invites of an admin who is removed", async () => {
    const second = await secondAdminWithInvite('from-removed@example.com');
    await request(app).delete(`/api/users/${second.id}`).set(auth(A.admin.token)).expect(204);

    await accept(linkFor('from-removed@example.com')).expect(404);
    const list = await request(app).get('/api/users/invites').set(auth(A.admin.token)).expect(200);
    expect(list.body.items.map((i: { email: string }) => i.email)).toEqual(['kept@example.com']);
    await accept(linkFor('kept@example.com')).expect(201);
  });

  it('should delete the pending invites of an admin who is demoted', async () => {
    const second = await secondAdminWithInvite('from-demoted@example.com');
    await request(app).patch(`/api/users/${second.id}`).set(auth(A.admin.token)).send({ role: 'user' }).expect(200);

    await accept(linkFor('from-demoted@example.com')).expect(404);
    await accept(linkFor('kept@example.com')).expect(201);
  });

  it('should keep the invites when the role does not go down', async () => {
    const second = await secondAdminWithInvite('still-valid@example.com');
    await request(app).patch(`/api/users/${second.id}`).set(auth(A.admin.token)).send({ role: 'admin' }).expect(200);
    await accept(linkFor('still-valid@example.com')).expect(201);
  });
});
