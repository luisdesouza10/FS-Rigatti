import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConversationModel } from '../src/models/conversation.model';
import { ProductModel } from '../src/models/product.model';
import { TenantIsolationError } from '../src/shared/errors';
import { HOME_PRODUCTS, TECH_PRODUCTS, clearDb, createTenant, startDb, stopDb } from './helpers';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('tenantGuard (Mongoose safety net)', () => {
  it('blocks queries without company_id', async () => {
    await createTenant('A', TECH_PRODUCTS);
    await expect(ProductModel.find({})).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(ProductModel.findOne({ name: 'Laptop Pro 14' })).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(ProductModel.updateMany({}, { price: 0 })).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(ProductModel.deleteMany({})).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(ProductModel.countDocuments()).rejects.toBeInstanceOf(TenantIsolationError);
    await expect(ConversationModel.find({})).rejects.toBeInstanceOf(TenantIsolationError);
  });

  it('blocks aggregates whose first stage is not a $match on company_id', async () => {
    await expect(ProductModel.aggregate([{ $group: { _id: '$category' } }])).rejects.toBeInstanceOf(
      TenantIsolationError,
    );
  });

  it('allows queries with company_id and the explicit opt-out', async () => {
    const a = await createTenant('A', TECH_PRODUCTS);
    await createTenant('B', HOME_PRODUCTS);
    expect(await ProductModel.countDocuments({ company_id: a.companyId })).toBe(TECH_PRODUCTS.length);
    expect(await ProductModel.countDocuments({}).setOptions({ skipTenantGuard: true })).toBe(
      TECH_PRODUCTS.length + HOME_PRODUCTS.length,
    );
  });
});
