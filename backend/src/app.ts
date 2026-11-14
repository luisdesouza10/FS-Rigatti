import fs from 'node:fs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { isDatabaseUp } from './db/connection';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { createRateLimiters } from './middlewares/rateLimit';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AgentService } from './modules/chat/agent/agent.service';
import { AnthropicLLMClient, type LLMClient } from './modules/chat/agent/llm.client';
import { createChatRouter } from './modules/chat/chat.routes';
import { productsRouter } from './modules/products/products.routes';
import { uploadsRouter } from './modules/uploads/uploads.routes';
import { createMailer, type Mailer } from './modules/mail/mailer';
import { createUsersRouter } from './modules/users/users.routes';

export interface AppDependencies {
  llm?: LLMClient;
  /** Defaults to SMTP (SMTP_URL) or, in development, the log. */
  mailer?: Mailer;
  /** Rate limits are off by default only under NODE_ENV=test. */
  rateLimit?: boolean;
  /** Overrides TRUST_PROXY (tests). */
  trustProxy?: boolean | number | string;
}

export function createApp(deps: AppDependencies = {}) {
  const app = express();
  const agent = new AgentService(deps.llm ?? new AnthropicLLMClient(), env.AGENT_MAX_TOOL_ITERATIONS);

  app.disable('x-powered-by');
  const mailer = deps.mailer ?? createMailer();
  const limits = createRateLimiters(deps.rateLimit ?? env.NODE_ENV !== 'test');

  app.set('trust proxy', deps.trustProxy ?? env.TRUST_PROXY);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()), credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  if (env.NODE_ENV !== 'test') app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  app.use('/uploads', express.static(env.UPLOAD_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));

  // Used by the Docker HEALTHCHECK: an API that can't reach MongoDB is not healthy.
  app.get('/api/health', async (_req, res) => {
    const up = await isDatabaseUp();
    res.status(up ? 200 : 503).json({ status: up ? 'ok' : 'error', database: up ? 'up' : 'down' });
  });
  app.use('/api/auth', createAuthRouter(limits, mailer));
  app.use('/api/users', createUsersRouter(mailer));
  app.use('/api/products', productsRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/chat', createChatRouter(agent, limits.chat));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
