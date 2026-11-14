import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { auth, clearDb, createTenant, startDb, stopDb } from './helpers';

const app = createApp();

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('request body limits', () => {
  it('should answer 413 with a clear message when the JSON body is over 100 KB', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'x'.repeat(200 * 1024) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(res.body.error.message).toMatch(/100 KB/);
  });

  it('should still accept a body just under the limit', async () => {
    const { admin } = await createTenant('TechNova', []);
    await request(app)
      .post('/api/products')
      .set(auth(admin.token))
      .send({ name: 'Mouse', price: 10, category: 'Peripherals', description: 'x'.repeat(2000), padding: 'y'.repeat(90 * 1024) })
      .expect(201);
  });
});

describe('health check', () => {
  it('should answer 200 when MongoDB is reachable', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('should answer 503 when MongoDB is down', async () => {
    await stopDb();
    try {
      const res = await request(app).get('/api/health').expect(503);
      expect(res.body).toMatchObject({ status: 'error', database: 'down' });
    } finally {
      await startDb();
    }
  });
});
