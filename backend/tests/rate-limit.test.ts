import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { clearDb, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const login = (app: ReturnType<typeof createApp>, email: string, ip: string) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ email, password: 'wrong-password' });

describe('login rate limit', () => {
  it('should not let a rotating X-Forwarded-For bypass the limit when TRUST_PROXY is off', async () => {
    // Each createApp gets its own limiter stores, so tests don't share counters.
    const app = createApp({ rateLimit: true });
    const statuses: number[] = [];
    for (let i = 1; i <= 31; i++) {
      statuses.push((await login(app, `victim${i}@store.com`, `203.0.113.${i}`)).status);
    }
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it('should limit failed logins per e-mail even when the client IP changes behind a trusted proxy', async () => {
    const app = createApp({ rateLimit: true, trustProxy: 1 });
    const statuses: number[] = [];
    for (let i = 1; i <= 11; i++) statuses.push((await login(app, 'victim@store.com', `203.0.113.${i}`)).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);

    // Another e-mail from yet another IP is unaffected.
    expect((await login(app, 'someone-else@store.com', '198.51.100.7')).status).toBe(401);
  });

  it('behind a trusted proxy, distinct real IPs get distinct IP quotas', async () => {
    const app = createApp({ rateLimit: true, trustProxy: 1 });
    for (let i = 1; i <= 30; i++) await login(app, `user${i}@store.com`, '203.0.113.1');
    expect((await login(app, 'user31@store.com', '203.0.113.1')).status).toBe(429);
    expect((await login(app, 'user32@store.com', '203.0.113.2')).status).toBe(401);
  });
});
