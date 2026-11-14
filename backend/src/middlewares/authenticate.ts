import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { UserModel } from '../models/user.model';
import { CSRF_HEADER, readSessionCookie } from '../modules/auth/session';
import { verifyToken } from '../modules/auth/token';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * The session comes from the httpOnly cookie (see session.ts). Role and company are
 * reloaded from the database, not trusted from the token, so demoting or removing a
 * user takes effect immediately. A token whose session version is older than the
 * user's (after logout or a password change) is rejected.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readSessionCookie(req);
  if (!token) throw new UnauthorizedError();
  // The browser attaches the cookie on its own, so writes must prove they come from the app (CSRF).
  if (!SAFE_METHODS.has(req.method) && !req.get(CSRF_HEADER)) {
    throw new ForbiddenError('Requisição bloqueada: falta o cabeçalho de proteção contra CSRF');
  }

  const payload = verifyToken(token);
  if (!isValidObjectId(payload.sub) || !isValidObjectId(payload.companyId)) {
    throw new UnauthorizedError('Token inválido ou expirado');
  }

  const user = await UserModel.findOne({ _id: payload.sub, company_id: payload.companyId })
    .select('_id role company_id +tokenVersion')
    .lean();
  if (!user || (user.tokenVersion ?? 0) !== payload.ver) throw new UnauthorizedError('Sessão inválida');

  req.tenant = {
    userId: String(user._id),
    companyId: String(user.company_id),
    role: user.role,
  };
  next();
};
