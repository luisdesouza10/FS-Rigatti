import type { Request } from 'express';
import { UnauthorizedError } from './errors';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

/** Built only from the verified token + database, never from client input. */
export interface TenantContext {
  userId: string;
  companyId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export function getTenant(req: Request): TenantContext {
  if (!req.tenant) throw new UnauthorizedError();
  return req.tenant;
}
