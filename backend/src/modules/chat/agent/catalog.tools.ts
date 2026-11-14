import { z } from 'zod';
import type { ProductDocument } from '../../../models/product.model';
import { productsRepository } from '../../products/products.repository';
import type { ToolDefinition } from './llm.client';

/**
 * No tool takes a company_id: handlers close over the authenticated user's companyId,
 * so the model chooses WHAT to search, never WHICH company — not even via prompt injection.
 * Definitions are static so they stay prompt-cacheable.
 */
export const CATALOG_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_products',
    description:
      "Searches the store's product catalog. Use it for any question about products, " +
      'availability, prices, comparisons or recommendations. All filters are optional and can be ' +
      'combined. `query` is a keyword search over name, description and category. The catalog is in ' +
      'Brazilian Portuguese, so use short Portuguese terms like "notebook" or "cadeira escritório" (accents optional). ' +
      'Prices are in Brazilian reais (BRL). ' +
      "If you don't know the existing categories, call list_categories first. `limit` ranges from 1 to 20 (default 10).",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords' },
        category: { type: 'string', description: 'Exact category name (see list_categories)' },
        min_price: { type: 'number', description: 'Minimum price in BRL' },
        max_price: { type: 'number', description: 'Maximum price in BRL' },
        sort: {
          type: 'string',
          enum: ['relevance', 'price_asc', 'price_desc', 'newest'],
          description: 'Result ordering',
        },
        limit: { type: 'integer', description: 'Maximum number of items (1 to 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_product_details',
    description:
      'Returns all details of a specific product by id (from search_products). ' +
      'Use it when the customer wants more information about an item.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { product_id: { type: 'string', description: 'Product id' } },
      required: ['product_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_categories',
    description:
      'Lists catalog categories with the product count and price range of each. ' +
      'Use it for a catalog overview or to find the exact name of a category.',
    strict: true,
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const searchInput = z.object({
  query: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest']).optional(),
  limit: z.number().int().min(1).max(20).optional(),
});
const detailsInput = z.object({ product_id: z.string().trim().min(1).max(64) });
const categoriesInput = z.object({});

export interface ProductRef {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl: string;
}

export interface ToolExecutionResult {
  content: string;
  isError: boolean;
  resultCount?: number;
}

const toToolProduct = (p: ProductDocument, full = false) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  description: full || p.description.length <= 240 ? p.description : `${p.description.slice(0, 240)}…`,
  ...(full && p.imageUrl && { image_url: p.imageUrl }),
});

const ok = (data: unknown, resultCount?: number): ToolExecutionResult => ({
  content: JSON.stringify(data),
  isError: false,
  resultCount,
});
const fail = (message: string): ToolExecutionResult => ({ content: JSON.stringify({ error: message }), isError: true });

export function createCatalogTools(companyId: string) {
  // Only products returned by the tools can become links in the UI; ids made up by the model never reach the client.
  const seen = new Map<string, ProductRef>();
  const remember = (p: ProductDocument) =>
    seen.set(p.id, { id: p.id, name: p.name, category: p.category, price: p.price, imageUrl: p.imageUrl });

  const handlers: Record<string, (input: unknown) => Promise<ToolExecutionResult>> = {
    async search_products(raw) {
      const input = searchInput.parse(raw);
      const { items, total } = await productsRepository.search(companyId, {
        query: input.query,
        category: input.category,
        minPrice: input.min_price,
        maxPrice: input.max_price,
        sort: input.sort,
        limit: input.limit ?? 10,
      });
      items.forEach(remember);
      return ok({ total_found: total, returned: items.length, products: items.map((p) => toToolProduct(p)) }, total);
    },

    async get_product_details(raw) {
      const { product_id } = detailsInput.parse(raw);
      const product = await productsRepository.findById(companyId, product_id);
      if (!product) return fail('Product not found in this catalog');
      remember(product);
      return ok({ product: toToolProduct(product, true) }, 1);
    },

    async list_categories(raw) {
      categoriesInput.parse(raw);
      const categories = await productsRepository.categories(companyId);
      return ok({ categories }, categories.length);
    },
  };

  return {
    definitions: CATALOG_TOOL_DEFINITIONS,

    seenProducts: seen,

    async execute(name: string, input: unknown): Promise<ToolExecutionResult> {
      const handler = handlers[name];
      if (!handler) return fail(`Unknown tool: ${name}`);
      try {
        return await handler(input);
      } catch (err) {
        if (err instanceof z.ZodError) {
          const issues = err.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ');
          return fail(`Invalid parameters: ${issues}`);
        }
        throw err;
      }
    },
  };
}

export type CatalogTools = ReturnType<typeof createCatalogTools>;
