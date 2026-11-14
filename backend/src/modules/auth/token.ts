import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors';
import { ROLES, type Role } from '../../shared/tenant';

const TokenPayloadSchema = z.object({
  sub: z.string(),
  companyId: z.string(),
  role: z.enum(ROLES),
  /** Session version (see User.tokenVersion). Absent in tokens issued before it existed. */
  ver: z.number().int().nonnegative().default(0),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export function signToken(payload: { userId: string; companyId: string; role: Role; tokenVersion?: number }): string {
  return jwt.sign({ companyId: payload.companyId, role: payload.role, ver: payload.tokenVersion ?? 0 }, env.JWT_SECRET, {
    subject: payload.userId,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    // Pinning the algorithm blocks algorithm-swap attacks (e.g. "none").
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return TokenPayloadSchema.parse(decoded);
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado');
  }
}
