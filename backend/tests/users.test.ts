import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { UserModel } from '../src/models/user.model';
import { HOME_PRODUCTS, TECH_PRODUCTS, auth, clearDb, createTenant, createUser, sessionToken, startDb, stopDb } from './helpers';

const app = createApp();
let A: Awaited<ReturnType<typeof createTenant>>;
let B: Awaited<ReturnType<typeof createTenant>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  A = await createTenant('TechNova', TECH_PRODUCTS);
  B = await createTenant('Casa Bella', HOME_PRODUCTS);
});

describe('team management: role changes', () => {
  it('should promote a user to admin with immediate effect', async () => {
    await request(app).get('/api/users').set(auth(A.user.token)).expect(403);
    const res = await request(app)
      .patch(`/api/users/${A.user.id}`)
      .set(auth(A.admin.token))
      .send({ role: 'admin' })
      .expect(200);
    expect(res.body.role).toBe('admin');
    // Same token as before: the role is read from the database on every request.
    await request(app).get('/api/users').set(auth(A.user.token)).expect(200);
  });

  it('should demote an admin with immediate effect', async () => {
    const second = await createUser(A.companyId, 'admin', 'second@technova.test');
    await request(app).patch(`/api/users/${second.id}`).set(auth(A.admin.token)).send({ role: 'user' }).expect(200);
    await request(app).get('/api/users').set(auth(second.token)).expect(403);
  });

  it('should not let the last admin demote themselves', async () => {
    const res = await request(app)
      .patch(`/api/users/${A.admin.id}`)
      .set(auth(A.admin.token))
      .send({ role: 'user' })
      .expect(409);
    expect(res.body.error.message).toMatch(/administrador/i);
    expect((await UserModel.findById(A.admin.id))?.role).toBe('admin');
  });

  it('should reject an invalid role', async () => {
    await request(app).patch(`/api/users/${A.user.id}`).set(auth(A.admin.token)).send({ role: 'owner' }).expect(400);
  });
});

describe('team management: removal', () => {
  it('should remove a user, whose old token then gets 401', async () => {
    await request(app).delete(`/api/users/${A.user.id}`).set(auth(A.admin.token)).expect(204);
    await request(app).get('/api/products').set(auth(A.user.token)).expect(401);
    const list = await request(app).get('/api/users').set(auth(A.admin.token)).expect(200);
    expect(list.body.items.map((u: { id: string }) => u.id)).not.toContain(A.user.id);
  });

  it('should not remove the last admin', async () => {
    await request(app).delete(`/api/users/${A.admin.id}`).set(auth(A.admin.token)).expect(409);
    expect(await UserModel.exists({ _id: A.admin.id })).not.toBeNull();
  });

  it('should allow removing an admin when another admin remains', async () => {
    const second = await createUser(A.companyId, 'admin', 'second@technova.test');
    await request(app).delete(`/api/users/${second.id}`).set(auth(A.admin.token)).expect(204);
  });
});

describe('team management: isolation and permissions', () => {
  it("should answer 404 when an admin targets another company's user", async () => {
    await request(app).patch(`/api/users/${B.user.id}`).set(auth(A.admin.token)).send({ role: 'admin' }).expect(404);
    await request(app).delete(`/api/users/${B.user.id}`).set(auth(A.admin.token)).expect(404);
    const untouched = await UserModel.findById(B.user.id);
    expect(untouched?.role).toBe('user');
  });

  it('should answer 403 to a non-admin and 404 to an invalid id', async () => {
    await request(app).patch(`/api/users/${A.admin.id}`).set(auth(A.user.token)).send({ role: 'user' }).expect(403);
    await request(app).delete(`/api/users/${A.admin.id}`).set(auth(A.user.token)).expect(403);
    await request(app).delete('/api/users/not-an-id').set(auth(A.admin.token)).expect(404);
  });
});

describe('sessions', () => {
  const password = 'password12345'; // helpers.createUser's password

  it('should end the session on the server at logout', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'user@technova.test', password }).expect(200);
    const token = sessionToken(login)!;
    await request(app).get('/api/auth/me').set(auth(token)).expect(200);

    await request(app).post('/api/auth/logout').set(auth(token)).expect(204);
    await request(app).get('/api/auth/me').set(auth(token)).expect(401);

    // Logging in again works.
    const again = await request(app).post('/api/auth/login').send({ email: 'user@technova.test', password }).expect(200);
    await request(app).get('/api/auth/me').set(auth(sessionToken(again)!)).expect(200);
  });

  it('should change the password only with the current one and end other sessions', async () => {
    const wrong = await request(app)
      .put('/api/auth/password')
      .set(auth(A.user.token))
      .send({ currentPassword: 'not-my-password', newPassword: 'brand-new-pass' })
      .expect(400);
    expect(wrong.body.error.details[0].field).toBe('currentPassword');

    const ok = await request(app)
      .put('/api/auth/password')
      .set(auth(A.user.token))
      .send({ currentPassword: password, newPassword: 'brand-new-pass' })
      .expect(200);
    await request(app).get('/api/auth/me').set(auth(sessionToken(ok)!)).expect(200);
    await request(app).get('/api/auth/me').set(auth(A.user.token)).expect(401);

    await request(app).post('/api/auth/login').send({ email: 'user@technova.test', password }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'user@technova.test', password: 'brand-new-pass' }).expect(200);
  });

  it('should validate the new password like at sign-up', async () => {
    await request(app)
      .put('/api/auth/password')
      .set(auth(A.user.token))
      .send({ currentPassword: password, newPassword: 'x'.repeat(73) })
      .expect(400);
    await request(app).put('/api/auth/password').send({ currentPassword: password, newPassword: 'brand-new-pass' }).expect(401);
  });
});
