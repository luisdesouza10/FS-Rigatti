import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { requireRole } from '../../middlewares/requireRole';
import { imageUpload, verifyImageContent } from '../../middlewares/upload';
import { BadRequestError } from '../../shared/errors';
import { getTenant } from '../../shared/tenant';

export const uploadsRouter = Router();

uploadsRouter.post('/', authenticate, requireRole('admin'), imageUpload.single('image'), verifyImageContent, (req, res) => {
  if (!req.file) throw new BadRequestError('Envie um arquivo no campo "image"');
  const { companyId } = getTenant(req);
  res.status(201).json({ url: `/uploads/${companyId}/${req.file.filename}` });
});
