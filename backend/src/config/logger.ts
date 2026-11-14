import pino from 'pino';
import { env } from './env';

const LOG_LEVEL = { development: 'debug', test: 'silent', production: 'info' } as const;

export const logger = pino({
  level: LOG_LEVEL[env.NODE_ENV],
  redact: ['req.headers.authorization', '*.password', '*.passwordHash'],
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  }),
});
