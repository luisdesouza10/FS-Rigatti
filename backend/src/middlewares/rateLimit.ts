import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

const message = { error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' } };

export interface RateLimiters {
  auth: RequestHandler;
  loginPerEmail: RequestHandler;
  chat: RequestHandler;
}

/** Built per app so each instance (and each test) has its own counters. */
export function createRateLimiters(enabled: boolean): RateLimiters {
  const skip = () => !enabled;
  const common = { standardHeaders: 'draft-8', legacyHeaders: false, skip, message } as const;

  return {
    // Per client IP. The IP is only as real as TRUST_PROXY allows (see app.ts).
    auth: rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 30 }),

    // Per target account, so rotating IPs doesn't help brute-force one password.
    // Successful logins don't count, so the owner isn't locked out by their own use.
    loginPerEmail: rateLimit({
      ...common,
      windowMs: 15 * 60 * 1000,
      limit: 10,
      skipSuccessfulRequests: true,
      keyGenerator: (req) => {
        const email = (req.body as { email?: unknown } | undefined)?.email;
        return `login:${typeof email === 'string' ? email.trim().toLowerCase() : ''}`;
      },
    }),

    chat: rateLimit({
      ...common,
      windowMs: 60 * 1000,
      limit: 20,
      keyGenerator: (req) => req.tenant?.userId ?? 'anonymous',
    }),
  };
}
