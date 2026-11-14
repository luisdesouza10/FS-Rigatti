import { Types, isValidObjectId, type QueryFilter } from 'mongoose';
import { ProductModel, type Product } from '../../models/product.model';
import { escapeRegex, searchTerms } from '../../shared/text';
import type { ProductInput, ProductUpdate } from './products.schemas';

export type ProductSort = 'relevance' | 'name' | 'price_asc' | 'price_desc' | 'newest';

export interface ProductSearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  skip?: number;
  limit: number;
}

const SORTS: Record<ProductSort, Record<string, 1 | -1>> = {
  relevance: { name: 1 },
  name: { name: 1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  newest: { createdAt: -1 },
};

export const productsRepository = {
  async search(companyId: string, params: ProductSearchParams) {
    const filter = buildFilter(companyId, params);
    const sort = SORTS[params.sort ?? 'newest'];

    let [items, total] = await Promise.all([
      ProductModel.find(filter).sort(sort).skip(params.skip ?? 0).limit(params.limit),
      ProductModel.countDocuments(filter),
    ]);

    // No match for ALL terms? Fall back to ANY term (e.g. "cheap bluetooth headphones").
    const terms = params.query ? searchTerms(params.query) : [];
    if (total === 0 && terms.length > 1) {
      const relaxed = buildFilter(companyId, params, 'any');
      [items, total] = await Promise.all([
        ProductModel.find(relaxed).sort(sort).skip(params.skip ?? 0).limit(params.limit),
        ProductModel.countDocuments(relaxed),
      ]);
    }
    return { items, total };
  },

  findById(companyId: string, id: string) {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return ProductModel.findOne({ _id: id, company_id: companyId });
  },

  create(companyId: string, data: ProductInput) {
    return ProductModel.create({ ...data, company_id: new Types.ObjectId(companyId) });
  },

  /** findOne + save (not findOneAndUpdate) so validation and the searchText hook run. */
  async update(companyId: string, id: string, data: ProductUpdate) {
    const product = await this.findById(companyId, id);
    if (!product) return null;
    product.set(data);
    return product.save();
  },

  async delete(companyId: string, id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await ProductModel.deleteOne({ _id: id, company_id: companyId });
    return result.deletedCount === 1;
  },

  distinctCategories(companyId: string): Promise<string[]> {
    return ProductModel.distinct('category', { company_id: new Types.ObjectId(companyId) });
  },

  categories(companyId: string) {
    return ProductModel.aggregate<{ category: string; count: number; minPrice: number; maxPrice: number }>([
      { $match: { company_id: new Types.ObjectId(companyId) } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
        },
      },
      { $project: { _id: 0, category: '$_id', count: 1, minPrice: 1, maxPrice: 1 } },
      { $sort: { category: 1 } },
    ]);
  },
};

function buildFilter(companyId: string, params: ProductSearchParams, match: 'all' | 'any' = 'all') {
  const filter: QueryFilter<Product> = { company_id: new Types.ObjectId(companyId) };

  if (params.category) {
    filter.category = { $regex: `^${escapeRegex(params.category.trim())}$`, $options: 'i' };
  }
  if (params.minPrice != null || params.maxPrice != null) {
    filter.price = {
      ...(params.minPrice != null && { $gte: params.minPrice }),
      ...(params.maxPrice != null && { $lte: params.maxPrice }),
    };
  }
  const terms = params.query ? searchTerms(params.query) : [];
  if (terms.length) {
    const clauses = terms.map((t) => ({ searchText: { $regex: escapeRegex(t) } }));
    if (match === 'all') filter.$and = clauses;
    else filter.$or = clauses;
  }
  return filter;
}
