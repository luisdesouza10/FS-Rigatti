import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import type { RateLimiters } from '../../middlewares/rateLimit';
import type { Mailer } from '../mail/mailer';
import { getTenant } from '../../shared/tenant';
import { acceptInviteSchema, changePasswordSchema, confirmEmailSchema, inviteTokenSchema, loginSchema, registerSchema } from './auth.schemas';
import { authService, type AuthResult } from './auth.service';
import { clearSessionCookie, setSessionCookie } from './session';

/** Starts the session in the httpOnly cookie; the token never goes in the response body. */
function sendSession(req: Request, res: Response, status: number, { token, ...session }: AuthResult) {
  setSessionCookie(req, res, token);
  res.status(status).json(session);
}

export function createAuthRouter(limits: RateLimiters, mailer: Mailer) {
  const authRouter = Router();

  // 202: nothing exists until the e-mail's owner opens the confirmation link.
  authRouter.post('/register', limits.auth, async (req, res) => {
    const input = registerSchema.parse(req.body);
    res.status(202).json(await authService.register(input, mailer));
  });

  authRouter.post('/confirm-email', limits.auth, async (req, res) => {
    const { token } = confirmEmailSchema.parse(req.body);
    sendSession(req, res, 201, await authService.confirmEmail(token));
  });

  authRouter.post('/login', limits.auth, limits.loginPerEmail, async (req, res) => {
    const input = loginSchema.parse(req.body);
    sendSession(req, res, 200, await authService.login(input));
  });

  // Public: the token in the link is the credential. Rate limited like login.
  authRouter.get('/invites/:token', limits.auth, async (req, res) => {
    res.json(await authService.inviteInfo(inviteTokenSchema.parse(req.params.token)));
  });

  authRouter.post('/accept-invite', limits.auth, async (req, res) => {
    sendSession(req, res, 201, await authService.acceptInvite(acceptInviteSchema.parse(req.body)));
  });

  authRouter.get('/me', authenticate, async (req, res) => {
    const { companyId, userId } = getTenant(req);
    res.json(await authService.me(companyId, userId));
  });

  // The cookie is cleared even when the session is no longer valid (the 401 still carries it).
  authRouter.post('/logout', (req, res, next) => {
    clearSessionCookie(req, res);
    next();
  }, authenticate, async (req, res) => {
    const { companyId, userId } = getTenant(req);
    await authService.logout(companyId, userId);
    res.status(204).end();
  });

  // Rate limited like login: it checks a password.
  authRouter.put('/password', limits.auth, authenticate, async (req, res) => {
    const { companyId, userId } = getTenant(req);
    const input = changePasswordSchema.parse(req.body);
    sendSession(req, res, 200, await authService.changePassword(companyId, userId, input));
  });

  return authRouter;
}
