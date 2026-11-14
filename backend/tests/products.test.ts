import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { ProductModel } from '../src/models/product.model';
import { FakeMailer, HOME_PRODUCTS, TECH_PRODUCTS, auth, clearDb, createTenant, startDb, stopDb } from './helpers';

const mailer = new FakeMailer();
const app = createApp({ mailer });
let A: Awaited<ReturnType<typeof createTenant>>;
let B: Awaited<ReturnType<typeof createTenant>>;

beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  A = await createTenant('TechNova', TECH_PRODUCTS);
  B = await createTenant('Casa Bella', HOME_PRODUCTS);
});

const newProduct = { name: 'Ergo Mouse', description: 'Wireless mouse', price: 39.9, category: 'Peripherals' };

describe('multi-tenant isolation', () => {
  it("listing returns only the user's company products", async () => {
    const res = await request(app).get('/api/products').set(auth(A.user.token)).expect(200);
    expect(res.body.total).toBe(TECH_PRODUCTS.length);
    const names = res.body.items.map((p: { name: string }) => p.name);
    expect(names).not.toContain('Aurora Sofa');
  });

  it("GET/PUT/DELETE on another company's product → 404 (existence not revealed)", async () => {
    const foreignId = B.products[0]!.id;
    await request(app).get(`/api/products/${foreignId}`).set(auth(A.admin.token)).expect(404);
    await request(app).put(`/api/products/${foreignId}`).set(auth(A.admin.token)).send({ price: 1 }).expect(404);
    await request(app).delete(`/api/products/${foreignId}`).set(auth(A.admin.token)).expect(404);

    const untouched = await ProductModel.findOne({ _id: foreignId, company_id: B.companyId });
    expect(untouched?.price).toBe(HOME_PRODUCTS[0]!.price);
  });

  it("a forged company_id in the body is ignored: the product is created in the token's tenant", async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth(A.admin.token))
      .send({ ...newProduct, company_id: B.companyId })
      .expect(201);
    const saved = await ProductModel.findOne({ _id: res.body.id, company_id: A.companyId });
    expect(saved).not.toBeNull();
    const leaked = await ProductModel.countDocuments({ company_id: B.companyId, name: newProduct.name });
    expect(leaked).toBe(0);
  });

  it('categories are computed over the tenant only', async () => {
    const res = await request(app).get('/api/products/categories').set(auth(B.user.token)).expect(200);
    expect(res.body.items.map((c: { category: string }) => c.category).sort()).toEqual(['Furniture', 'Lighting']);
  });
});

describe('permissions (RBAC)', () => {
  it('user can read but not create/update/delete', async () => {
    const id = A.products[0]!.id;
    await request(app).get(`/api/products/${id}`).set(auth(A.user.token)).expect(200);
    await request(app).post('/api/products').set(auth(A.user.token)).send(newProduct).expect(403);
    await request(app).put(`/api/products/${id}`).set(auth(A.user.token)).send({ price: 1 }).expect(403);
    await request(app).delete(`/api/products/${id}`).set(auth(A.user.token)).expect(403);
  });

  it('user cannot manage the team', async () => {
    await request(app).get('/api/users').set(auth(A.user.token)).expect(403);
  });

  it('no token → 401', async () => {
    await request(app).get('/api/products').expect(401);
  });
});

describe('product CRUD (admin)', () => {
  it('creates, updates and deletes', async () => {
    const created = await request(app).post('/api/products').set(auth(A.admin.token)).send(newProduct).expect(201);
    expect(created.body).toMatchObject({ name: 'Ergo Mouse', price: 39.9 });
    expect(created.body.company_id).toBe(A.companyId);

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .set(auth(A.admin.token))
      .send({ price: 29.9 })
      .expect(200);
    expect(updated.body.price).toBe(29.9);

    await request(app).delete(`/api/products/${created.body.id}`).set(auth(A.admin.token)).expect(204);
    await request(app).get(`/api/products/${created.body.id}`).set(auth(A.admin.token)).expect(404);
  });

  it('validates input', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth(A.admin.token))
      .send({ name: 'X', price: -5, category: '' })
      .expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(['name', 'price', 'category']),
    );
  });

  it('search ignores case, accents and plurals; category is an exact match', async () => {
    const res = await request(app).get('/api/products?search=LAPTOPS').set(auth(A.user.token)).expect(200);
    expect(res.body.total).toBe(2);
    const audio = await request(app).get('/api/products?category=audi').set(auth(A.user.token)).expect(200);
    expect(audio.body.total).toBe(0);
    const headphones = await request(app).get('/api/products?search=héadphones').set(auth(A.user.token)).expect(200);
    expect(headphones.body.total).toBe(1);
  });

  it('should keep description and imageUrl when PUT sends only price', async () => {
    const created = await request(app)
      .post('/api/products')
      .set(auth(A.admin.token))
      .send({ ...newProduct, imageUrl: 'https://cdn.example.com/mouse.png' })
      .expect(201);

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .set(auth(A.admin.token))
      .send({ price: 150 })
      .expect(200);
    expect(updated.body).toMatchObject({
      price: 150,
      description: newProduct.description,
      imageUrl: 'https://cdn.example.com/mouse.png',
    });
  });

  it('PUT can still clear description and imageUrl explicitly', async () => {
    const created = await request(app)
      .post('/api/products')
      .set(auth(A.admin.token))
      .send({ ...newProduct, imageUrl: 'https://cdn.example.com/mouse.png' })
      .expect(201);

    const updated = await request(app)
      .put(`/api/products/${created.body.id}`)
      .set(auth(A.admin.token))
      .send({ description: '', imageUrl: '' })
      .expect(200);
    expect(updated.body).toMatchObject({ description: '', imageUrl: '', price: newProduct.price });
  });

  it('should reject a price that is not a number or numeric string', async () => {
    for (const price of ['', null, true, [5], 'abc', '1e3', '12.345']) {
      const res = await request(app)
        .post('/api/products')
        .set(auth(A.admin.token))
        .send({ ...newProduct, price })
        .expect(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('price');
    }
    const id = A.products[0]!.id;
    await request(app).put(`/api/products/${id}`).set(auth(A.admin.token)).send({ price: null }).expect(400);
    expect(await ProductModel.countDocuments({ company_id: A.companyId, name: newProduct.name })).toBe(0);
  });

  it('should accept a numeric price as number or string and round it to cents', async () => {
    for (const [price, expected] of [
      ['199.90', 199.9],
      [199.9, 199.9],
      ['49,5', 49.5],
      [10.006, 10.01],
      [0, 0],
    ] as const) {
      const res = await request(app)
        .post('/api/products')
        .set(auth(A.admin.token))
        .send({ ...newProduct, price })
        .expect(201);
      expect(res.body.price).toBe(expected);
    }
  });

  it("should reuse the company's existing category spelling regardless of case, accents or spaces", async () => {
    for (const category of ['laptops', '  LAPTOPS ', 'Láptops']) {
      const res = await request(app)
        .post('/api/products')
        .set(auth(A.admin.token))
        .send({ ...newProduct, category })
        .expect(201);
      expect(res.body.category).toBe('Laptops');
    }
    const updated = await request(app)
      .put(`/api/products/${A.products[0]!.id}`)
      .set(auth(A.admin.token))
      .send({ category: 'AUDIO' })
      .expect(200);
    expect(updated.body.category).toBe('Audio');

    const categories = await request(app).get('/api/products/categories').set(auth(A.user.token)).expect(200);
    expect(categories.body.items.map((c: { category: string; count: number }) => [c.category, c.count])).toEqual([
      ['Audio', 2],
      ['Laptops', 4],
    ]);
  });

  it("should not reuse another company's category spelling", async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth(A.admin.token))
      .send({ ...newProduct, category: 'FURNITURE' })
      .expect(201);
    expect(res.body.category).toBe('FURNITURE');
  });

  it("should reject imageUrl pointing at another company's upload, plain http or a non-public host", async () => {
    const rejected = [
      `/uploads/${B.companyId}/0b7f3c1e-2d4a-4f7b-9a51-1c2d3e4f5a6b.png`,
      'http://cdn.example.com/mouse.png',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost/mouse.png',
      'https://[::1]/mouse.png',
      'javascript:alert(1)',
    ];
    for (const imageUrl of rejected) {
      const res = await request(app)
        .post('/api/products')
        .set(auth(A.admin.token))
        .send({ ...newProduct, imageUrl })
        .expect(400);
      expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain('imageUrl');
    }
    await request(app)
      .put(`/api/products/${A.products[0]!.id}`)
      .set(auth(A.admin.token))
      .send({ imageUrl: rejected[0] })
      .expect(400);
  });

  it('should accept an own upload, a public https URL or no image', async () => {
    for (const imageUrl of [
      `/uploads/${A.companyId}/0b7f3c1e-2d4a-4f7b-9a51-1c2d3e4f5a6b.webp`,
      'https://images.unsplash.com/photo-1?w=800',
      '',
    ]) {
      const res = await request(app)
        .post('/api/products')
        .set(auth(A.admin.token))
        .send({ ...newProduct, imageUrl })
        .expect(201);
      expect(res.body.imageUrl).toBe(imageUrl);
    }
  });

  it('invalid id → 404', async () => {
    await request(app).get('/api/products/not-an-id').set(auth(A.user.token)).expect(404);
  });
});

describe('team', () => {
  it('an invited user joins the inviting company only', async () => {
    await request(app)
      .post('/api/users/invites')
      .set(auth(A.admin.token))
      .send({ name: 'John', email: 'john@tech.com', role: 'user' })
      .expect(201);
    const accepted = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: mailer.lastToken('john@tech.com', 'convite'), password: 'password12345' })
      .expect(201);
    expect(accepted.body.company.id).toBe(A.companyId);

    const list = await request(app).get('/api/users').set(auth(B.admin.token)).expect(200);
    expect(list.body.items.map((u: { email: string }) => u.email)).not.toContain('john@tech.com');
  });
});
