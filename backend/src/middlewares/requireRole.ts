import type { RequestHandler } from 'express';
import { ForbiddenError } from '../shared/errors';
import { getTenant, type Role } from '../shared/tenant';

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = getTenant(req);
    if (!allowed.includes(role)) throw new ForbiddenError();
    next();
  };
}
