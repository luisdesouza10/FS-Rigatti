import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { auth, clearDb, createTenant, startDb, stopDb } from './helpers';

const app = createApp();
let A: Awaited<ReturnType<typeof createTenant>>;

// Smallest valid 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

const companyFiles = () => {
  const dir = path.join(env.UPLOAD_DIR, A.companyId);
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

const upload = (body: Buffer, filename: string, contentType: string) =>
  request(app).post('/api/uploads').set(auth(A.admin.token)).attach('image', body, { filename, contentType });

beforeAll(startDb);
afterAll(async () => {
  await stopDb();
  fs.rmSync(env.UPLOAD_DIR, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearDb();
  A = await createTenant('TechNova', []);
});

describe('uploads', () => {
  it('should accept real PNG, JPEG and WEBP files', async () => {
    const png = await upload(PNG, 'a.png', 'image/png').expect(201);
    expect(png.body.url).toMatch(new RegExp(`^/uploads/${A.companyId}/[\\w-]+\\.png$`));
    await upload(JPEG, 'a.jpg', 'image/jpeg').expect(201);
    await upload(WEBP, 'a.webp', 'image/webp').expect(201);
    expect(companyFiles()).toHaveLength(3);
  });

  it('should reject text or SVG sent as image/png and keep nothing on disk', async () => {
    const svg = await upload(SVG, 'evil.png', 'image/png').expect(400);
    expect(svg.body.error.message).toMatch(/JPG, PNG ou WEBP/);
    await upload(Buffer.from('just some text'), 'notes.png', 'image/png').expect(400);
    expect(companyFiles()).toHaveLength(0);
  });

  it('should reject a real image whose declared type does not match its content', async () => {
    await upload(JPEG, 'a.png', 'image/png').expect(400);
    expect(companyFiles()).toHaveLength(0);
  });
});
