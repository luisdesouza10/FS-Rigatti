import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

/**
 * The session JWT lives in an httpOnly cookie: page scripts (and so an XSS) can't read it.
 * SameSite=Strict keeps other sites from sending it; Secure follows the request's protocol,
 * so it is on behind HTTPS and off on http://localhost and the LAN, where a Secure cookie
 * would not be stored at all.
 */
export const SESSION_COOKIE = 'vitrine_session';

/**
 * Header that cookie-authenticated writes must carry. An HTML form on another site can't
 * set it, and a cross-origin fetch with it needs a CORS preflight that the API refuses.
 */
export const CSRF_HEADER = 'X-Requested-With';

function cookieOptions(req: Request): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure: req.secure, path: '/api' };
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  // The cookie expires together with the token inside it.
  const { exp } = jwt.decode(token) as { exp: number };
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(req), expires: new Date(exp * 1000) });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req));
}

export function readSessionCookie(req: Request): string | undefined {
  for (const pair of req.headers.cookie?.split(';') ?? []) {
    const [name, ...value] = pair.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='));
  }
  return undefined;
}
