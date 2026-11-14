import { BadRequestError, NotFoundError } from '../../shared/errors';
import { normalizeText } from '../../shared/text';
import { productsRepository } from './products.repository';
import { UPLOAD_PATH, type ProductInput, type ProductListQuery, type ProductUpdate } from './products.schemas';

const categoryKey = (value: string) => normalizeText(value).replace(/\s+/g, ' ');

/**
 * "notebooks", "NOTEBOOKS " and "Notebooks" are one category: reuse the spelling the
 * company already has (ignoring case, accents and spacing) instead of creating a new one.
 */
async function canonicalCategory(companyId: string, category: string): Promise<string> {
  const key = categoryKey(category);
  const existing = await productsRepository.distinctCategories(companyId);
  return existing.find((c) => categoryKey(c) === key) ?? category.replace(/\s+/g, ' ');
}

/** An uploaded image may only be used by the company that uploaded it. */
function assertOwnUpload(companyId: string, imageUrl: string | undefined) {
  const match = imageUrl ? UPLOAD_PATH.exec(imageUrl) : null;
  if (match && match[1] !== companyId) {
    const message = 'Use uma imagem enviada pela sua empresa';
    throw new BadRequestError('Dados inválidos', [{ field: 'imageUrl', message }]);
  }
}

// Another company's product yields 404 (not 403) so its existence is not revealed.
export const productsService = {
  async list(companyId: string, query: ProductListQuery) {
    const { items, total } = await productsRepository.search(companyId, {
      query: query.search,
      category: query.category,
      sort: query.sort,
      skip: (query.page - 1) * query.limit,
      limit: query.limit,
    });
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  },

  async get(companyId: string, id: string) {
    const product = await productsRepository.findById(companyId, id);
    if (!product) throw new NotFoundError('Produto');
    return product;
  },

  async create(companyId: string, input: ProductInput) {
    assertOwnUpload(companyId, input.imageUrl);
    return productsRepository.create(companyId, { ...input, category: await canonicalCategory(companyId, input.category) });
  },

  async update(companyId: string, id: string, input: ProductUpdate) {
    assertOwnUpload(companyId, input.imageUrl);
    if (input.category) input = { ...input, category: await canonicalCategory(companyId, input.category) };
    const product = await productsRepository.update(companyId, id, input);
    if (!product) throw new NotFoundError('Produto');
    return product;
  },

  async remove(companyId: string, id: string) {
    const deleted = await productsRepository.delete(companyId, id);
    if (!deleted) throw new NotFoundError('Produto');
  },

  categories(companyId: string) {
    return productsRepository.categories(companyId);
  },
};
