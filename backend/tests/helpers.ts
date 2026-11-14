import bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { CompanyModel } from '../src/models/company.model';
import { ConversationModel } from '../src/models/conversation.model';
import { InvitationModel } from '../src/models/invitation.model';
import { PendingSignupModel } from '../src/models/pendingSignup.model';
import { ProductModel } from '../src/models/product.model';
import { UserModel } from '../src/models/user.model';
import { CSRF_HEADER, SESSION_COOKIE } from '../src/modules/auth/session';
import { signToken } from '../src/modules/auth/token';
import type { Role } from '../src/shared/tenant';

let mongo: MongoMemoryServer | undefined;

export async function startDb() {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([ProductModel.syncIndexes(), UserModel.syncIndexes(), CompanyModel.syncIndexes(), InvitationModel.syncIndexes(), PendingSignupModel.syncIndexes()]);
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongo?.stop();
}

export async function clearDb() {
  await Promise.all([
    ProductModel.deleteMany({}).setOptions({ skipTenantGuard: true }),
    ConversationModel.deleteMany({}).setOptions({ skipTenantGuard: true }),
    InvitationModel.deleteMany({}).setOptions({ skipTenantGuard: true }),
    PendingSignupModel.deleteMany({}),
    UserModel.deleteMany({}),
    CompanyModel.deleteMany({}),
  ]);
}

const hash = bcrypt.hashSync('password12345', 4);

export async function createUser(companyId: string, role: Role, email: string) {
  const user = await UserModel.create({ name: email, email, role, passwordHash: hash, company_id: companyId });
  return { id: user.id as string, token: signToken({ userId: user.id, companyId, role }) };
}

export async function createTenant(name: string, products: { name: string; category: string; price: number }[]) {
  const company = await CompanyModel.create({ name, slug: name.toLowerCase().replace(/\W+/g, '-') });
  const companyId = company.id as string;
  const slug = company.slug;
  const admin = await createUser(companyId, 'admin', `admin@${slug}.test`);
  const user = await createUser(companyId, 'user', `user@${slug}.test`);
  const created = await ProductModel.create(
    products.map((p) => ({ ...p, description: `Description of ${p.name}`, company_id: company._id })),
  );
  return { companyId, admin, user, products: created.map((p) => ({ id: p.id as string, name: p.name })) };
}

export const TECH_PRODUCTS = [
  { name: 'Laptop Pro 14', category: 'Laptops', price: 1399.9 },
  { name: 'Essential Laptop', category: 'Laptops', price: 599 },
  { name: 'Bluetooth Headphones', category: 'Audio', price: 139.9 },
];

export const HOME_PRODUCTS = [
  { name: 'Aurora Sofa', category: 'Furniture', price: 1299 },
  { name: 'Arc Floor Lamp', category: 'Lighting', price: 189.9 },
];

/** What the browser sends for a signed-in user: the session cookie plus the CSRF header. */
export const auth = (token: string) => ({ Cookie: `${SESSION_COOKIE}=${token}`, [CSRF_HEADER]: 'XMLHttpRequest' });

/** Session token from a response's Set-Cookie, or undefined. */
export function sessionToken(res: { headers: Record<string, unknown> }): string | undefined {
  const cookies = (res.headers['set-cookie'] as string[] | undefined) ?? [];
  const match = cookies.map((c) => new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(c)).find(Boolean);
  return match?.[1] || undefined;
}

/** Collects e-mails instead of sending them; tests read links from here, never from API responses. */
export class FakeMailer {
  sent: { to: string; subject: string; text: string; html: string }[] = [];
  fail = false;

  async send(message: { to: string; subject: string; text: string; html: string }) {
    if (this.fail) throw new Error('SMTP unavailable');
    this.sent.push(message);
  }

  to(email: string) {
    return this.sent.filter((m) => m.to === email);
  }

  /** Token of the last link of this kind sent to the address, or undefined. */
  lastToken(email: string, path: 'convite' | 'confirmar-email'): string | undefined {
    const texts = this.to(email).map((m) => m.text).reverse();
    for (const text of texts) {
      const match = new RegExp(String.raw`/${path}/([\w-]+)`).exec(text);
      if (match) return match[1];
    }
    return undefined;
  }

  clear() {
    this.sent = [];
  }
}
