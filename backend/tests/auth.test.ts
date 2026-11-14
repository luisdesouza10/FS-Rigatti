import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { CompanyModel } from '../src/models/company.model';
import { PendingSignupModel } from '../src/models/pendingSignup.model';
import { UserModel } from '../src/models/user.model';
import { signToken } from '../src/modules/auth/token';
import { FakeMailer, auth, clearDb, createTenant, sessionToken, startDb, stopDb } from './helpers';

const mailer = new FakeMailer();
const app = createApp({ mailer });

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  mailer.clear();
  mailer.fail = false;
});

const registerBody = { companyName: 'New Store', name: 'Ana', email: 'ana@store.com', password: 'password12345' };

/** Signs up and clicks the confirmation link, like a real person would. */
async function registerAndConfirm(body: Partial<typeof registerBody> = {}) {
  const input = { ...registerBody, ...body };
  await request(app).post('/api/auth/register').send(input).expect(202);
  const token = mailer.lastToken(input.email, 'confirmar-email');
  return request(app).post('/api/auth/confirm-email').send({ token }).expect(201);
}

describe('sign-up with e-mail confirmation (F14)', () => {
  it('should not create the company or the account until the e-mail is confirmed', async () => {
    const res = await request(app).post('/api/auth/register').send(registerBody).expect(202);
    expect(res.body.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/confirmar-email\//);
    expect(await UserModel.countDocuments({ email: 'ana@store.com' })).toBe(0);
    expect(await CompanyModel.countDocuments({ name: 'New Store' })).toBe(0);
    await request(app).post('/api/auth/login').send({ email: registerBody.email, password: registerBody.password }).expect(401);

    const token = mailer.lastToken('ana@store.com', 'confirmar-email');
    expect(token).toBeTypeOf('string');
    const confirmed = await request(app).post('/api/auth/confirm-email').send({ token }).expect(201);
    expect(sessionToken(confirmed)).toBeTypeOf('string');
    expect(confirmed.body.token).toBeUndefined();
    expect(confirmed.body.user).toMatchObject({ email: 'ana@store.com', role: 'admin' });
    expect(confirmed.body.company.name).toBe('New Store');
    expect(confirmed.body.user.passwordHash).toBeUndefined();

    await request(app).post('/api/auth/login').send({ email: registerBody.email, password: registerBody.password }).expect(200);
    // Single use.
    await request(app).post('/api/auth/confirm-email').send({ token }).expect(404);
  });

  it("should answer an e-mail that already has an account exactly like a new one, and warn its owner", async () => {
    const first = await request(app).post('/api/auth/register').send(registerBody).expect(202);
    await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: mailer.lastToken('ana@store.com', 'confirmar-email') })
      .expect(201);
    mailer.clear();

    const again = await request(app)
      .post('/api/auth/register')
      .send({ ...registerBody, companyName: 'Hijack Ltd', password: 'other-password' })
      .expect(202);
    expect(again.body).toEqual(first.body);

    const warning = mailer.to('ana@store.com');
    expect(warning).toHaveLength(1);
    expect(mailer.lastToken('ana@store.com', 'confirmar-email')).toBeUndefined();
    expect(await CompanyModel.countDocuments({ name: 'Hijack Ltd' })).toBe(0);
    await request(app).post('/api/auth/login').send({ email: registerBody.email, password: 'other-password' }).expect(401);
  });

  it('should replace a pending sign-up when the same e-mail registers again', async () => {
    await request(app).post('/api/auth/register').send(registerBody).expect(202);
    const oldToken = mailer.lastToken('ana@store.com', 'confirmar-email');
    await request(app).post('/api/auth/register').send({ ...registerBody, companyName: 'Second Try' }).expect(202);
    const newToken = mailer.lastToken('ana@store.com', 'confirmar-email');
    expect(newToken).not.toBe(oldToken);

    await request(app).post('/api/auth/confirm-email').send({ token: oldToken }).expect(404);
    const res = await request(app).post('/api/auth/confirm-email').send({ token: newToken }).expect(201);
    expect(res.body.company.name).toBe('Second Try');
  });

  it('should reject an expired confirmation link', async () => {
    await request(app).post('/api/auth/register').send(registerBody).expect(202);
    await PendingSignupModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    await request(app)
      .post('/api/auth/confirm-email')
      .send({ token: mailer.lastToken('ana@store.com', 'confirmar-email') })
      .expect(404);
  });

  it('should answer 503 and keep nothing pending when the e-mail cannot be sent', async () => {
    mailer.fail = true;
    await request(app).post('/api/auth/register').send(registerBody).expect(503);
    expect(await PendingSignupModel.countDocuments({})).toBe(0);
  });

  it('validates the register body', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...registerBody, password: '123' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mailer.sent).toHaveLength(0);
  });
});

describe('auth', () => {
  it('should reject passwords longer than 72 UTF-8 bytes (bcrypt would ignore the rest)', async () => {
    const tooLong = `${'a'.repeat(72)}SEGREDO`;
    const res = await request(app).post('/api/auth/register').send({ ...registerBody, password: tooLong }).expect(400);
    expect(res.body.error.details[0].field).toBe('password');

    // 37 × "é" = 74 bytes even though it is only 37 characters.
    await request(app).post('/api/auth/register').send({ ...registerBody, password: 'é'.repeat(37) }).expect(400);
    // Accepting an invite applies the same rules (see invites.test.ts).
  });

  it('should accept a password of exactly 72 bytes and require all of it at login', async () => {
    const password = `${'é'.repeat(35)}ab`; // 70 + 2 = 72 bytes
    await registerAndConfirm({ password });
    await request(app).post('/api/auth/login').send({ email: registerBody.email, password }).expect(200);
    await request(app)
      .post('/api/auth/login')
      .send({ email: registerBody.email, password: `${'é'.repeat(35)}aX` })
      .expect(401);
  });

  it('should reject a password made only of spaces', async () => {
    await request(app).post('/api/auth/register').send({ ...registerBody, password: ' '.repeat(8) }).expect(400);
    await request(app).post('/api/auth/register').send({ ...registerBody, password: `\t${' '.repeat(10)}\n` }).expect(400);
  });

  it('should keep surrounding spaces as part of a valid password (no trim)', async () => {
    const password = '  pass word  ';
    await registerAndConfirm({ password });
    await request(app).post('/api/auth/login').send({ email: registerBody.email, password }).expect(200);
    await request(app).post('/api/auth/login').send({ email: registerBody.email, password: 'pass word' }).expect(401);
  });

  it('login with the right password starts a session; wrong → 401 with a generic message', async () => {
    await registerAndConfirm();
    const ok = await request(app).post('/api/auth/login').send({ email: 'ANA@store.com', password: 'password12345' }).expect(200);
    expect(sessionToken(ok)).toBeTypeOf('string');

    const wrong = await request(app).post('/api/auth/login').send({ email: 'ana@store.com', password: 'wrong1234' }).expect(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'x@y.com', password: 'wrong1234' }).expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('/me requires a valid token', async () => {
    const { admin } = await createTenant('Company A', []);
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set(auth('garbage')).expect(401);
    const me = await request(app).get('/api/auth/me').set(auth(admin.token)).expect(200);
    expect(me.body.company.name).toBe('Company A');
  });

  it('rejects tokens signed with another secret or alg "none"', async () => {
    const { admin, companyId } = await createTenant('Company A', []);
    const forged = jwt.sign({ companyId, role: 'admin' }, 'some-other-secret-with-32-characters!!', { subject: admin.id });
    await request(app).get('/api/auth/me').set(auth(forged)).expect(401);

    const none = jwt.sign({ companyId, role: 'admin' }, '', { subject: admin.id, algorithm: 'none' });
    await request(app).get('/api/auth/me').set(auth(none)).expect(401);
  });

  it("a token with another company's companyId does not authenticate", async () => {
    const a = await createTenant('Company A', []);
    const b = await createTenant('Company B', []);
    const crossed = signToken({ userId: a.admin.id, companyId: b.companyId, role: 'admin' });
    await request(app).get('/api/products').set(auth(crossed)).expect(401);
  });
});

describe('session cookie', () => {
  const login = () => request(app).post('/api/auth/login').send({ email: 'admin@company-a.test', password: 'password12345' });

  it('is httpOnly, SameSite=Strict, scoped to /api and never echoed in the body', async () => {
    await createTenant('Company A', []);
    const res = await login().expect(200);
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^vitrine_session=[^;]+/);
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Strict/i);
    expect(cookie).toMatch(/; Path=\/api/i);
    expect(cookie).toMatch(/; Expires=/i);
    expect(cookie).not.toMatch(/; Secure/i); // plain HTTP (localhost, LAN)
    expect(JSON.stringify(res.body)).not.toContain(sessionToken(res)!);
  });

  it('is Secure when the request arrived over HTTPS through the trusted proxy', async () => {
    await createTenant('Company A', []);
    const proxied = createApp({ mailer, trustProxy: 1 });
    const res = await request(proxied)
      .post('/api/auth/login')
      .set('X-Forwarded-Proto', 'https')
      .send({ email: 'admin@company-a.test', password: 'password12345' })
      .expect(200);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/; Secure/i);
  });

  it('no longer accepts the token in an Authorization header', async () => {
    const { admin } = await createTenant('Company A', []);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admin.token}`).expect(401);
  });

  it('requires the CSRF header on writes, but not on reads', async () => {
    const { admin } = await createTenant('Company A', []);
    const cookieOnly = { Cookie: auth(admin.token).Cookie };
    await request(app).get('/api/products').set(cookieOnly).expect(200);
    const blocked = await request(app)
      .post('/api/products')
      .set(cookieOnly)
      .send({ name: 'Mouse', category: 'Acessórios', price: 10 })
      .expect(403);
    expect(blocked.body.error.message).toMatch(/CSRF/);
    await request(app).post('/api/products').set(auth(admin.token)).send({ name: 'Mouse', category: 'Acessórios', price: 10 }).expect(201);
  });

  it('logout clears the cookie, even when the session was already invalid', async () => {
    const { admin } = await createTenant('Company A', []);
    const res = await request(app).post('/api/auth/logout').set(auth(admin.token)).expect(204);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^vitrine_session=;.*Expires=Thu, 01 Jan 1970/i);

    const stale = await request(app).post('/api/auth/logout').set(auth(admin.token)).expect(401);
    expect((stale.headers['set-cookie'] as unknown as string[])[0]).toMatch(/^vitrine_session=;/);
  });
});
