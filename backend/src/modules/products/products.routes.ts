import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { getTenant } from '../../shared/tenant';
import { productInputSchema, productListQuerySchema, productUpdateSchema } from './products.schemas';
import { productsService } from './products.service';

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get('/', async (req, res) => {
  const { companyId } = getTenant(req);
  res.json(await productsService.list(companyId, productListQuerySchema.parse(req.query)));
});

productsRouter.get('/categories', async (req, res) => {
  const { companyId } = getTenant(req);
  res.json({ items: await productsService.categories(companyId) });
});

productsRouter.get('/:id', async (req, res) => {
  const { companyId } = getTenant(req);
  res.json(await productsService.get(companyId, String(req.params.id)));
});

productsRouter.post('/', requireRole('admin'), async (req, res) => {
  const { companyId } = getTenant(req);
  res.status(201).json(await productsService.create(companyId, productInputSchema.parse(req.body)));
});

productsRouter.put('/:id', requireRole('admin'), async (req, res) => {
  const { companyId } = getTenant(req);
  res.json(await productsService.update(companyId, String(req.params.id), productUpdateSchema.parse(req.body)));
});

productsRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const { companyId } = getTenant(req);
  await productsService.remove(companyId, String(req.params.id));
  res.status(204).end();
});
