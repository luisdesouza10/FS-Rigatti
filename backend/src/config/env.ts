import path from 'node:path';
import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-secret-change-me-in-production-0123456789';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/catalog_ai'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').default(DEV_JWT_SECRET),
    JWT_EXPIRES_IN: z.string().default('8h'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    UPLOAD_DIR: z.string().default(path.resolve(__dirname, '../../uploads')),
    /** Frontend address used in links sent by e-mail (invites, sign-up confirmation). */
    APP_URL: z.url().default('http://localhost:5173').transform((v) => (v.endsWith('/') ? v.slice(0, -1) : v)),
    /** SMTP server, e.g. smtp://localhost:1025 (Mailpit). Unset outside production: e-mails go to the log. */
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('Vitrine IA <nao-responda@vitrine.local>'),
    /**
     * Express "trust proxy". Keep false when clients reach the API directly (npm run dev);
     * set to the number of proxies in front (1 behind the compose nginx). Otherwise a client
     * can forge X-Forwarded-For and dodge the per-IP rate limits.
     */
    TRUST_PROXY: z
      .string()
      .trim()
      .default('false')
      // eslint-disable-next-line sonarjs/function-return-type -- Express's `trust proxy` takes a boolean, hop count or IP list.
      .transform((v): boolean | number | string => {
        if (v === 'false' || v === '') return false;
        if (v === 'true') return true;
        return /^\d+$/.test(v) ? Number(v) : v;
      }),

    // Optional: the SDK can also resolve credentials from other sources.
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
    AGENT_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
    AGENT_REFUSAL_FALLBACK: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    AGENT_MAX_TOOL_ITERATIONS: z.coerce.number().int().min(1).max(15).default(6),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_JWT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'Set your own JWT_SECRET in production' });
    }
    if (env.NODE_ENV === 'production' && !env.SMTP_URL) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'Set SMTP_URL in production (invites and sign-up need e-mail)' });
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
