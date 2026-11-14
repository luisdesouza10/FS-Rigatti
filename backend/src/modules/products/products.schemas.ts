import { isIP } from 'node:net';
import { z } from 'zod';

/** Path returned by POST /api/uploads; the service checks the company segment is the user's. */
export const UPLOAD_PATH = /^\/uploads\/([\w-]+)\/[\w-]+\.(jpg|png|webp)$/i;

/** Every visitor's browser loads this URL, so only https on a public host name. */
function isPublicHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || isIP(host) !== 0) return false;
  return host.includes('.') && !/(^|\.)(localhost|local|internal)$/.test(host);
}

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || isPublicHttpsUrl(v) || UPLOAD_PATH.test(v), {
    message: 'Informe uma URL https pública ou envie uma imagem',
  });

// Only a finite number or a plain numeric string ("199.90", "49,5"). No coercion of
// "", null, booleans or arrays, which would silently become 0, 1 or 5.
const price = z
  .union(
    [
      z.number(),
      z
        .string()
        .trim()
        .regex(/^\d+([.,]\d{1,2})?$/)
        .transform((v) => Number(v.replace(',', '.'))),
    ],
    { error: 'Informe um preço numérico' },
  )
  .pipe(z.number().min(0, 'Preço não pode ser negativo').max(10_000_000))
  .transform((v) => Math.round(v * 100) / 100);

// No company_id here on purpose: unknown keys are stripped, so a forged one is ignored.
// The base has no defaults, so a partial update never overwrites fields the client didn't send.
const productFields = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  description: z.string().trim().max(2000),
  price,
  category: z.string().trim().min(2, 'Categoria muito curta').max(60),
  imageUrl,
});

export const productInputSchema = productFields.extend({
  description: productFields.shape.description.default(''),
  imageUrl: imageUrl.default(''),
});

export const productUpdateSchema = productFields.partial();

export const productListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  sort: z.enum(['newest', 'name', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
